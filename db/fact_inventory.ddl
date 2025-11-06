-- =====================================================
-- INVENTORY FACT TABLE (fact_inventory) - TRANSACTIONS
-- =====================================================
--
-- SEMANTICS:
-- • Transaction-level inventory movements (receipts, issues, adjustments, transfers)
-- • One row per transaction event, perpetual inventory tracking
-- • Supports valuation, turnover analysis, cycle counting, COGS
--
-- KEY FIELDS:
-- • transaction_type: varchar (receipt, issue, adjustment, transfer)
-- • transaction_qty: numeric (positive=receipt, negative=issue)
-- • product_id, office_id, employee_id: uuid (links)
-- • transaction_date: date
--
-- RELATIONSHIPS:
-- • d_product, fact_order, d_project, d_office, d_employee
--
-- =====================================================
-- - On-hand quantity, available quantity, allocated quantity
-- - Inventory value (at cost), average cost, FIFO cost
-- - Stock turnover rate, days on hand
-- - Variance quantity, shrinkage quantity
--
-- =====================================================

DROP TABLE IF EXISTS app.fact_inventory CASCADE;

CREATE TABLE app.fact_inventory (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Transaction Identification
    transaction_number VARCHAR(50) NOT NULL UNIQUE,     -- Unique transaction ID (e.g., "INV-TXN-2025-00123")
    transaction_type VARCHAR(50) NOT NULL,              -- 'receipt', 'issue', 'adjustment', 'transfer_out', 'transfer_in', 'return', 'cycle_count'
    transaction_subtype VARCHAR(50),                    -- 'purchase_receipt', 'job_issue', 'customer_return', 'damaged', 'obsolete'

    -- Date/Time Dimensions
    transaction_date DATE NOT NULL,                     -- Date of transaction
    transaction_datetime TIMESTAMP NOT NULL DEFAULT NOW(), -- Precise transaction timestamp
    posting_date DATE,                                  -- Accounting posting date (may differ from transaction date)

    -- Product Dimension
    product_id UUID NOT NULL,                           -- Link to d_product (REQUIRED)
    product_sku VARCHAR(50),                            -- Denormalized SKU
    product_name VARCHAR(255),                          -- Denormalized name
    product_category VARCHAR(100),                      -- Denormalized category

    -- Location Dimensions
    warehouse_id UUID,                                  -- Link to d_office (warehouse/location)
    warehouse_name VARCHAR(255),                        -- Denormalized warehouse name
    warehouse_location VARCHAR(50),                     -- Bin/aisle/shelf location
    zone VARCHAR(50),                                   -- Warehouse zone (receiving, storage, staging, shipping)

    -- Transfer Locations (if transfer transaction)
    from_warehouse_id UUID,                             -- Source warehouse (for transfers)
    from_warehouse_name VARCHAR(255),
    from_location VARCHAR(50),
    to_warehouse_id UUID,                               -- Destination warehouse (for transfers)
    to_warehouse_name VARCHAR(255),
    to_location VARCHAR(50),

    -- Quantity Metrics
    transaction_quantity DECIMAL(12,3) NOT NULL,        -- Qty moved (positive = in, negative = out)
    unit_of_measure VARCHAR(20) DEFAULT 'each',         -- 'each', 'ft', 'sqft', 'lb', 'gal'
    quantity_before DECIMAL(12,3),                      -- On-hand qty before transaction
    qty_after DECIMAL(12,3),                       -- On-hand qty after transaction

    -- Stock Level Snapshot (After Transaction)
    on_hand_qty DECIMAL(12,3),                     -- Physical quantity in warehouse
    allocated_quantity DECIMAL(12,3) DEFAULT 0,         -- Qty allocated to orders/projects
    available_quantity DECIMAL(12,3),                   -- On-hand minus allocated
    in_transit_quantity DECIMAL(12,3) DEFAULT 0,        -- Qty in transit from supplier
    on_order_quantity DECIMAL(12,3) DEFAULT 0,          -- Qty on purchase orders

    -- Costing (Canadian Dollars)
    unit_cost_cad DECIMAL(12,2),                        -- Unit cost at time of transaction
    extended_cost_cad DECIMAL(12,2),                    -- transaction_qty * unit_cost
    average_unit_cost_cad DECIMAL(12,2),                -- Running average cost
    fifo_unit_cost_cad DECIMAL(12,2),                   -- FIFO cost
    total_inventory_value_cad DECIMAL(12,2),            -- Total value of on-hand inventory

    -- Source/Reference Documents
    order_id UUID,                                      -- Link to fact_order (if issued for order)
    order_number VARCHAR(50),                           -- Denormalized order number
    project_id UUID,                                    -- Link to d_project (if issued to project)
    project_name VARCHAR(255),                          -- Denormalized project name
    invoice_id UUID,                                    -- Link to fact_invoice (if related)
    shipment_id UUID,                                   -- Link to fact_shipment (if related)
    po_number VARCHAR(100),                             -- Purchase order number (for receipts)
    supplier_id UUID,                                   -- Supplier (for receipts)
    supplier_name VARCHAR(255),                         -- Denormalized supplier name

    -- Transaction Details
    reason_code VARCHAR(50),                            -- Reason for transaction ('normal', 'damaged', 'expired', 'lost', 'found', 'correction')
    lot_number VARCHAR(100),                            -- Lot/batch tracking
    serial_number VARCHAR(100),                         -- Serial number tracking
    expiry_date DATE,                                   -- Expiration date (for perishables)
    manufacture_date DATE,                              -- Manufacturing date

    -- Personnel
    performed_by_employee_id UUID,                      -- Employee who performed transaction
    performed_by_name VARCHAR(255),                     -- Denormalized employee name
    authorized_by_employee_id UUID,                     -- Manager who authorized (for adjustments)
    authorized_by_name VARCHAR(255),

    -- Cycle Count Details (if applicable)
    cycle_count_id UUID,                                -- Link to cycle count session
    counted_quantity DECIMAL(12,3),                     -- Physical count quantity
    variance_quantity DECIMAL(12,3),                    -- Difference (counted - system)
    variance_value_cad DECIMAL(12,2),                   -- Dollar value of variance

    -- Reorder Status
    reorder_point DECIMAL(12,3),                        -- Reorder point at time of transaction
    reorder_qty DECIMAL(12,3),                     -- Standard reorder qty
    below_reorder_point BOOLEAN DEFAULT false,          -- Flag if qty fell below reorder point
    reorder_triggered BOOLEAN DEFAULT false,            -- Flag if reorder was triggered

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    last_modified_by UUID,

    -- Metadata
    notes TEXT,                                         -- Transaction notes
    tags TEXT[]                                         -- Searchable tags
);

-- Indexes for performance
CREATE INDEX idx_inventory_transaction_number ON app.fact_inventory(transaction_number);
CREATE INDEX idx_inventory_transaction_date ON app.fact_inventory(transaction_date);
CREATE INDEX idx_inventory_transaction_type ON app.fact_inventory(transaction_type);
CREATE INDEX idx_inventory_product ON app.fact_inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON app.fact_inventory(warehouse_id);
CREATE INDEX idx_inventory_order ON app.fact_inventory(order_id);
CREATE INDEX idx_inventory_project ON app.fact_inventory(project_id);
CREATE INDEX idx_inventory_lot ON app.fact_inventory(lot_number);
CREATE INDEX idx_inventory_serial ON app.fact_inventory(serial_number);

-- Trigger to calculate extended values and stock levels
CREATE OR REPLACE FUNCTION app.calculate_inventory_extended() RETURNS TRIGGER AS $$
BEGIN
    -- Calculate extended cost
    NEW.extended_cost_cad := NEW.transaction_quantity * COALESCE(NEW.unit_cost_cad, 0);

    -- Calculate quantity after
    NEW.qty_after := COALESCE(NEW.quantity_before, 0) + NEW.transaction_quantity;

    -- Calculate available quantity
    NEW.available_quantity := COALESCE(NEW.on_hand_quantity, 0) - COALESCE(NEW.allocated_quantity, 0);

    -- Calculate variance (for cycle counts)
    IF NEW.transaction_type = 'cycle_count' THEN
        NEW.variance_quantity := COALESCE(NEW.counted_quantity, 0) - COALESCE(NEW.quantity_before, 0);
        NEW.variance_value_cad := NEW.variance_quantity * COALESCE(NEW.unit_cost_cad, 0);
    END IF;

    -- Check reorder status
    IF NEW.qty_after <= NEW.reorder_point THEN
        NEW.below_reorder_point := true;
    ELSE
        NEW.below_reorder_point := false;
    END IF;

    -- Calculate total inventory value
    NEW.total_inventory_value_cad := COALESCE(NEW.on_hand_quantity, 0) * COALESCE(NEW.average_unit_cost_cad, NEW.unit_cost_cad, 0);

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_calculate_extended BEFORE INSERT OR UPDATE ON app.fact_inventory
    FOR EACH ROW EXECUTE FUNCTION app.calculate_inventory_extended();

-- =====================================================
-- SAMPLE DATA: Curated Inventory Transactions
-- =====================================================

-- Get warehouse/office ID (using first office as default warehouse)
DO $$
DECLARE
    default_warehouse_id UUID;
BEGIN
    SELECT id INTO default_warehouse_id FROM app.d_office LIMIT 1;

    -- Receipt transactions (incoming stock)
    INSERT INTO app.fact_inventory (
        transaction_number, transaction_type, transaction_subtype, transaction_date, transaction_datetime,
        product_id, product_sku, product_name, product_category,
        warehouse_id, warehouse_name, warehouse_location,
        transaction_quantity, unit_of_measure, quantity_before,
        unit_cost_cad, average_unit_cost_cad, po_number, supplier_name,
        performed_by_name, reorder_point, reorder_quantity, on_hand_quantity
    ) VALUES
    -- Lumber receipts
    ('INV-TXN-2025-00001', 'receipt', 'purchase_receipt', '2025-01-05', '2025-01-05 08:30:00',
     (SELECT id FROM app.d_product WHERE sku = 'LBR-2X4-8'), 'LBR-2X4-8', '2x4 Spruce Stud 8ft', 'Lumber',
     default_warehouse_id, 'Main Warehouse', 'A-12-3',
     500, 'each', 200,
     4.20, 4.20, 'PO-2025-001', 'West Fraser',
     'James Miller', 100, 500, 700),

    ('INV-TXN-2025-00002', 'receipt', 'purchase_receipt', '2025-01-06', '2025-01-06 09:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'LBR-PLY-3/4'), 'LBR-PLY-3/4', '3/4" Plywood Sheet 4x8', 'Lumber',
     default_warehouse_id, 'Main Warehouse', 'A-14-2',
     200, 'sheet', 75,
     32.00, 32.00, 'PO-2025-002', 'Tolko',
     'James Miller', 50, 200, 275),

    -- Electrical supplies receipt
    ('INV-TXN-2025-00003', 'receipt', 'purchase_receipt', '2025-01-07', '2025-01-07 10:15:00',
     (SELECT id FROM app.d_product WHERE sku = 'ELC-WIRE-14/2'), 'ELC-WIRE-14/2', '14/2 NMD90 Wire 75m', 'Electrical',
     default_warehouse_id, 'Main Warehouse', 'B-08-1',
     100, 'roll', 30,
     62.00, 62.00, 'PO-2025-003', 'Southwire',
     'James Miller', 20, 100, 130),

    ('INV-TXN-2025-00004', 'receipt', 'purchase_receipt', '2025-01-07', '2025-01-07 10:30:00',
     (SELECT id FROM app.d_product WHERE sku = 'ELC-OUTLET-15A'), 'ELC-OUTLET-15A', 'Duplex Receptacle 15A White', 'Electrical',
     default_warehouse_id, 'Main Warehouse', 'B-10-5',
     500, 'each', 300,
     1.40, 1.40, 'PO-2025-003', 'Leviton',
     'James Miller', 200, 500, 800);

    -- Issue transactions (outgoing stock for jobs)
    INSERT INTO app.fact_inventory (
        transaction_number, transaction_type, transaction_subtype, transaction_date, transaction_datetime,
        product_id, product_sku, product_name, product_category,
        warehouse_id, warehouse_name,
        transaction_quantity, unit_of_measure, quantity_before,
        unit_cost_cad, average_unit_cost_cad,
        order_number, project_name, performed_by_name, on_hand_quantity
    ) VALUES
    -- Issue for Smith Residence job
    ('INV-TXN-2025-00005', 'issue', 'job_issue', '2025-01-10', '2025-01-10 07:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'LBR-2X4-8'), 'LBR-2X4-8', '2x4 Spruce Stud 8ft', 'Lumber',
     default_warehouse_id, 'Main Warehouse',
     -150, 'each', 700,
     4.20, 4.20,
     'ORD-2025-00001', 'Smith Residence Renovation', 'James Miller', 550),

    ('INV-TXN-2025-00006', 'issue', 'job_issue', '2025-01-10', '2025-01-10 07:15:00',
     (SELECT id FROM app.d_product WHERE sku = 'LBR-PLY-3/4'), 'LBR-PLY-3/4', '3/4" Plywood Sheet 4x8', 'Lumber',
     default_warehouse_id, 'Main Warehouse',
     -25, 'sheet', 275,
     32.00, 32.00,
     'ORD-2025-00001', 'Smith Residence Renovation', 'James Miller', 250),

    -- Issue for electrical project
    ('INV-TXN-2025-00007', 'issue', 'job_issue', '2025-01-12', '2025-01-12 08:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'ELC-WIRE-14/2'), 'ELC-WIRE-14/2', '14/2 NMD90 Wire 75m', 'Electrical',
     default_warehouse_id, 'Main Warehouse',
     -40, 'roll', 130,
     62.00, 62.00,
     'ORD-2025-00002', 'Downtown Office Building', 'James Miller', 90),

    ('INV-TXN-2025-00008', 'issue', 'job_issue', '2025-01-12', '2025-01-12 08:15:00',
     (SELECT id FROM app.d_product WHERE sku = 'ELC-OUTLET-15A'), 'ELC-OUTLET-15A', 'Duplex Receptacle 15A White', 'Electrical',
     default_warehouse_id, 'Main Warehouse',
     -200, 'each', 800,
     1.40, 1.40,
     'ORD-2025-00002', 'Downtown Office Building', 'James Miller', 600);

    -- Adjustment transaction (cycle count found variance)
    INSERT INTO app.fact_inventory (
        transaction_number, transaction_type, transaction_subtype, transaction_date, transaction_datetime,
        product_id, product_sku, product_name, product_category,
        warehouse_id, warehouse_name,
        transaction_quantity, unit_of_measure, quantity_before, counted_quantity,
        unit_cost_cad, average_unit_cost_cad,
        reason_code, performed_by_name, authorized_by_name, on_hand_quantity
    ) VALUES
    ('INV-TXN-2025-00009', 'cycle_count', 'physical_count', '2025-01-15', '2025-01-15 16:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'LBR-2X4-8'), 'LBR-2X4-8', '2x4 Spruce Stud 8ft', 'Lumber',
     default_warehouse_id, 'Main Warehouse',
     -5, 'each', 550, 545,
     4.20, 4.20,
     'shrinkage', 'James Miller', 'James Miller', 545);

    -- Plumbing fixtures receipt
    INSERT INTO app.fact_inventory (
        transaction_number, transaction_type, transaction_subtype, transaction_date, transaction_datetime,
        product_id, product_sku, product_name, product_category,
        warehouse_id, warehouse_name, warehouse_location,
        transaction_quantity, unit_of_measure, quantity_before,
        unit_cost_cad, average_unit_cost_cad, po_number, supplier_name,
        performed_by_name, reorder_point, reorder_quantity, on_hand_quantity
    ) VALUES
    ('INV-TXN-2025-00010', 'receipt', 'purchase_receipt', '2025-01-16', '2025-01-16 11:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'PLM-TOILET-STD'), 'PLM-TOILET-STD', 'Elongated Toilet 2-Piece', 'Plumbing',
     default_warehouse_id, 'Main Warehouse', 'C-05-1',
     20, 'each', 8,
     175.00, 175.00, 'PO-2025-005', 'American Standard',
     'James Miller', 5, 20, 28),

    ('INV-TXN-2025-00011', 'receipt', 'purchase_receipt', '2025-01-17', '2025-01-17 09:30:00',
     (SELECT id FROM app.d_product WHERE sku = 'PLM-PIPE-3/4'), 'PLM-PIPE-3/4', '3/4" Type L Copper Pipe 10ft', 'Plumbing',
     default_warehouse_id, 'Main Warehouse', 'C-08-2',
     150, 'length', 45,
     24.50, 24.50, 'PO-2025-006', 'IPEX',
     'James Miller', 30, 150, 195);

    -- Paint supplies receipt
    INSERT INTO app.fact_inventory (
        transaction_number, transaction_type, transaction_subtype, transaction_date, transaction_datetime,
        product_id, product_sku, product_name, product_category,
        warehouse_id, warehouse_name, warehouse_location,
        transaction_quantity, unit_of_measure, quantity_before,
        unit_cost_cad, average_unit_cost_cad, po_number, supplier_name,
        performed_by_name, reorder_point, reorder_quantity, on_hand_quantity
    ) VALUES
    ('INV-TXN-2025-00012', 'receipt', 'purchase_receipt', '2025-01-18', '2025-01-18 10:00:00',
     (SELECT id FROM app.d_product WHERE sku = 'PNT-INT-GAL-WHT'), 'PNT-INT-GAL-WHT', 'Interior Latex Paint Gallon White', 'Paint',
     default_warehouse_id, 'Main Warehouse', 'D-02-1',
     100, 'gallon', 40,
     35.00, 35.00, 'PO-2025-007', 'Benjamin Moore',
     'James Miller', 30, 100, 140),

    ('INV-TXN-2025-00013', 'receipt', 'purchase_receipt', '2025-01-18', '2025-01-18 10:15:00',
     (SELECT id FROM app.d_product WHERE sku = 'PNT-PRIMER-GAL'), 'PNT-PRIMER-GAL', 'Primer Sealer Gallon', 'Paint',
     default_warehouse_id, 'Main Warehouse', 'D-03-2',
     80, 'gallon', 30,
     24.00, 24.00, 'PO-2025-007', 'Kilz',
     'James Miller', 25, 80, 110);

END $$;

-- Update timestamps
UPDATE app.fact_inventory SET updated_at = NOW();
