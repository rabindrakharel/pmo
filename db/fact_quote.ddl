-- =====================================================
-- QUOTE FACT TABLE (fact_quote)
-- Customer quotes for services and products
-- =====================================================
--
-- SEMANTICS:
-- Quotes represent pricing proposals for customers tied to tasks.
-- Each quote includes multiple services and products stored in quote_items JSONB array.
-- Quotes track total revenue, stage progression, validity period, and approval status.
-- In-place updates (same ID, version++), soft delete preserves historical data.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with version=1, active_flag=true
--   Example: INSERT INTO fact_quote (id, code, name, descr, dl__quote_stage,
--                                     quote_total_amt, quote_items, valid_until_date)
--            VALUES ('q1111111-...', 'QT-2024-001', 'HVAC Installation Quote',
--                    'Complete HVAC installation for residential client', 'Draft',
--                    8500.00, '[{"item_type":"service","item_id":"s1111111-...","quantity":1.0,"unit_rate":5500.00}]'::jsonb,
--                    '2024-12-31')
--
-- • UPDATE: Same ID, version++, updated_ts refreshes
--   Example: UPDATE fact_quote SET dl__quote_stage='Sent', sent_date=now(), version=version+1
--            WHERE id='q1111111-...'
--
-- • SOFT DELETE: active_flag=false, to_ts=now()
--   Example: UPDATE fact_quote SET active_flag=false, to_ts=now() WHERE id='q1111111-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable, never changes)
-- • code: varchar(50) UNIQUE NOT NULL (business identifier: 'QT-2024-001')
-- • name: text NOT NULL (display name: 'HVAC Installation Quote')
-- • dl__quote_stage: text (references setting_datalabel: 'Draft', 'Sent', 'Accepted', 'Rejected', etc.)
-- • quote_items: jsonb (array of line items with services and products)
-- • quote_tax_amt: decimal(15,2) (calculated tax amount)
-- • quote_total_amt: decimal(15,2) (total quote amount including tax)
-- • subtotal_amt: decimal(15,2) (amount before tax and discounts)
-- • discount_pct: numeric(5,2) (discount percentage if applicable)
-- • discount_amt: decimal(15,2) (discount dollar amount)
-- • valid_until_date: date (quote expiration date)
-- • sent_date, accepted_date, rejected_date: date (workflow tracking)
--
-- QUOTE_ITEMS JSONB STRUCTURE:
-- Array of line item objects with per-line discounts and taxes:
-- [
--   {
--     "item_type": "service",          // 'service' or 'product'
--     "item_id": "s1111111-...",       // UUID of service or product
--     "item_code": "SVC-HVAC-001",     // Business code for reference
--     "item_name": "HVAC Installation", // Display name
--     "quantity": 1.0,                 // Quantity
--     "unit_rate": 5500.00,            // Rate per unit (before discount/tax)
--     "discount_pct": 10.00,           // Line discount percentage (0-100)
--     "discount_amt": 550.00,          // Calculated: unit_rate × quantity × (discount_pct/100)
--     "subtotal": 4950.00,             // After discount: (unit_rate × quantity) - discount_amt
--     "tax_pct": 13.00,                // Tax percentage (13% HST for Ontario)
--     "tax_amt": 643.50,               // Calculated: subtotal × (tax_pct/100)
--     "line_total": 5593.50,           // Final total: subtotal + tax_amt
--     "line_notes": "Notes..."         // Optional line item notes
--   },
--   ...
-- ]
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: task (via d_entity_id_map)
-- • References: d_service, d_product (via quote_items JSONB, no FK)
--
-- DATALABEL INTEGRATION:
-- • dl__quote_stage: setting_datalabel WHERE datalabel_name='dl__quote_stage'
-- • Frontend renders: Colored badges, stage progression, workflow actions
--
-- =====================================================

CREATE TABLE app.fact_quote (
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

    -- Quote-specific fields
    dl__quote_stage text, -- References app.setting_datalabel (datalabel_name='dl__quote_stage')

    -- Line items: services and products
    quote_items jsonb DEFAULT '[]'::jsonb, -- Array of line items (services and products)

    -- Financial fields
    subtotal_amt decimal(15,2) DEFAULT 0.00, -- Subtotal before tax and discounts
    discount_pct numeric(5,2) DEFAULT 0.00, -- Discount percentage
    discount_amt decimal(15,2) DEFAULT 0.00, -- Discount dollar amount
    tax_pct numeric(5,2) DEFAULT 13.00, -- Tax percentage (default 13% HST for Ontario)
    quote_tax_amt decimal(15,2) DEFAULT 0.00, -- Tax amount
    quote_total_amt decimal(15,2) DEFAULT 0.00, -- Total quote amount (subtotal - discount + tax)

    -- Quote lifecycle
    valid_until_date date, -- Quote expiration date
    sent_date date, -- Date quote was sent to customer
    accepted_date date, -- Date quote was accepted
    rejected_date date, -- Date quote was rejected

    -- Customer & project context (stored in metadata or via entity_id_map)
    customer_name text, -- Customer name for quick reference
    customer_email text, -- Customer contact email
    customer_phone text, -- Customer contact phone

    -- Internal notes
    internal_notes text, -- Internal notes not visible to customer
    customer_notes text -- Notes/terms visible to customer
);

COMMENT ON TABLE app.fact_quote IS 'Quote fact table tracking customer quotes for services and products';
COMMENT ON COLUMN app.fact_quote.quote_items IS 'JSONB array of line items with per-line discounts and taxes: [{"item_type":"service/product","item_id":"uuid","item_code":"code","item_name":"name","quantity":1.0,"unit_rate":100.00,"discount_pct":10.00,"discount_amt":10.00,"subtotal":90.00,"tax_pct":13.00,"tax_amt":11.70,"line_total":101.70,"line_notes":"..."}]';

-- =====================================================
-- DATA CURATION: Sample Quotes for Tasks
-- =====================================================

-- Quote for HVAC Installation (Task: DT-TASK-002)
-- Line-by-line calculations for London, Ontario (13% HST)
INSERT INTO app.fact_quote (code, name, descr, metadata,
    dl__quote_stage,
    quote_items,
    subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
    valid_until_date, sent_date, accepted_date,
    customer_name, customer_email, customer_phone,
    internal_notes, customer_notes
) VALUES
(
    'QT-2024-001',
    'Complete HVAC System Installation Quote',
    'Quote for complete HVAC system installation including 3-ton unit, thermostat, and installation labor',
    '{"task_id": "a2222222-2222-2222-2222-222222222222", "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Accepted',
    '[
        {"item_type":"service","item_code":"SVC-HVAC-001","item_name":"HVAC System Installation","quantity":1.0,"unit_rate":5500.00,"discount_pct":10.00,"discount_amt":550.00,"subtotal":4950.00,"tax_pct":13.00,"tax_amt":643.50,"line_total":5593.50,"line_notes":"Complete HVAC installation including ductwork modifications - 10% early booking discount"},
        {"item_type":"service","item_code":"SVC-HVAC-002","item_name":"HVAC Maintenance Service","quantity":1.0,"unit_rate":200.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":200.00,"tax_pct":13.00,"tax_amt":26.00,"line_total":226.00,"line_notes":"Initial maintenance service - complimentary 6-month checkup included"},
        {"item_type":"product","item_code":"PRD-HVAC-001","item_name":"Carrier 3-Ton Central Air Conditioner","quantity":1.0,"unit_rate":3200.00,"discount_pct":5.00,"discount_amt":160.00,"subtotal":3040.00,"tax_pct":13.00,"tax_amt":395.20,"line_total":3435.20,"line_notes":"Carrier 3-ton central AC unit - model CA-36K3 - 5% manufacturer rebate"},
        {"item_type":"product","item_code":"PRD-HVAC-002","item_name":"Honeywell Smart Thermostat","quantity":1.0,"unit_rate":220.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":220.00,"tax_pct":13.00,"tax_amt":28.60,"line_total":248.60,"line_notes":"Honeywell smart thermostat with WiFi"},
        {"item_type":"product","item_code":"PRD-HVAC-003","item_name":"HVAC Air Filter 20x25x1","quantity":2.0,"unit_rate":28.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":56.00,"tax_pct":13.00,"tax_amt":7.28,"line_total":63.28,"line_notes":"Premium air filters - 1 year supply (2 boxes)"}
    ]'::jsonb,
    8466.00, 8.39, 710.00, 13.00, 1100.58, 9566.58,
    '2024-12-31', '2024-10-15', '2024-10-20',
    'Residential Customer A', 'customer.a@example.com', '519-555-0101',
    'VIP customer - applied volume discounts on installation and equipment. Installation scheduled for November 15th.',
    'Total savings: $710 (8.4% overall). Installation includes 2-year warranty on equipment and labor. HST (13%) included in all prices.'
),
(
    'QT-2024-002',
    'Fall Landscaping Service Package Quote',
    'Comprehensive fall cleanup and winterization package including leaf removal, garden bed prep, and lawn care',
    '{"task_id": "b1111111-1111-1111-1111-111111111111", "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Sent',
    '[
        {"item_type":"service","item_code":"SVC-LAND-001","item_name":"Fall Cleanup Service","quantity":2.0,"unit_rate":600.00,"discount_pct":15.00,"discount_amt":180.00,"subtotal":1020.00,"tax_pct":13.00,"tax_amt":132.60,"line_total":1152.60,"line_notes":"Fall cleanup - 2 visits scheduled (Oct 28, Nov 15) - 15% multi-visit discount"},
        {"item_type":"service","item_code":"SVC-LAND-002","item_name":"Lawn Care & Maintenance","quantity":1.0,"unit_rate":180.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":180.00,"tax_pct":13.00,"tax_amt":23.40,"line_total":203.40,"line_notes":"Final lawn care before winter - aeration and overseeding"},
        {"item_type":"product","item_code":"PRD-LAND-001","item_name":"Premium Mulch - Cubic Yard","quantity":3.0,"unit_rate":65.00,"discount_pct":5.00,"discount_amt":9.75,"subtotal":185.25,"tax_pct":13.00,"tax_amt":24.08,"line_total":209.33,"line_notes":"Premium cedar mulch - 3 cubic yards - 5% bulk discount"},
        {"item_type":"product","item_code":"PRD-LAND-002","item_name":"Lawn Fertilizer 50lb Bag","quantity":2.0,"unit_rate":48.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":96.00,"tax_pct":13.00,"tax_amt":12.48,"line_total":108.48,"line_notes":"Fall lawn fertilizer - 2 bags (50 lb each) for winterization"}
    ]'::jsonb,
    1481.25, 12.79, 189.75, 13.00, 192.56, 1673.81,
    '2024-11-30', '2024-10-25', NULL,
    'Commercial Property Manager B', 'manager.b@commercial.com', '416-555-0202',
    'Commercial property discount applied. Follow up in 3 days. Property has 3 acres requiring multiple service visits.',
    'Package includes 4 service visits throughout fall season. Total savings: $189.75. HST (13%) included. Additional visits charged at hourly rate.'
);

-- Quote for Plumbing Renovation (New Task Context)
INSERT INTO app.fact_quote (code, name, descr, metadata,
    dl__quote_stage,
    quote_items,
    subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
    valid_until_date, sent_date, accepted_date, rejected_date,
    customer_name, customer_email, customer_phone,
    internal_notes, customer_notes
) VALUES
(
    'QT-2024-003',
    'Kitchen Plumbing Renovation Quote',
    'Complete kitchen plumbing renovation including new fixtures, water heater, and supply lines',
    '{"task_id": "c1111111-1111-1111-1111-111111111111", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Rejected',
    '[
        {"item_type":"service","item_code":"SVC-PLUMB-001","item_name":"Plumbing Installation","quantity":1.0,"unit_rate":3200.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":3200.00,"tax_pct":13.00,"tax_amt":416.00,"line_total":3616.00,"line_notes":"Complete plumbing installation for kitchen renovation - includes rough-in and finish work"},
        {"item_type":"product","item_code":"PRD-PLUMB-001","item_name":"Rheem 50-Gallon Water Heater","quantity":1.0,"unit_rate":650.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":650.00,"tax_pct":13.00,"tax_amt":84.50,"line_total":734.50,"line_notes":"Rheem 50-gallon electric water heater with 6-year warranty"},
        {"item_type":"product","item_code":"PRD-PLUMB-002","item_name":"Kohler Kitchen Faucet","quantity":1.0,"unit_rate":285.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":285.00,"tax_pct":13.00,"tax_amt":37.05,"line_total":322.05,"line_notes":"Kohler kitchen faucet - commercial style, stainless steel finish"},
        {"item_type":"product","item_code":"PRD-PLUMB-003","item_name":"PEX Tubing 1/2 inch 100ft Roll","quantity":4.0,"unit_rate":85.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":340.00,"tax_pct":13.00,"tax_amt":44.20,"line_total":384.20,"line_notes":"PEX-B tubing 1/2 inch - 4 rolls (400 ft total) for hot/cold supply lines"}
    ]'::jsonb,
    4475.00, 0.00, 0.00, 13.00, 581.75, 5056.75,
    '2024-11-15', '2024-10-05', NULL, '2024-10-18',
    'Residential Customer C', 'customer.c@example.com', '647-555-0303',
    'Customer cited budget concerns. May revisit in Q1 2025 with scaled-down scope or phased approach.',
    'Quote valid for 45 days. Includes removal of old fixtures and proper disposal. HST (13%) included in all prices.'
);

-- Quote for Electrical Panel Upgrade
INSERT INTO app.fact_quote (code, name, descr, metadata,
    dl__quote_stage,
    quote_items,
    subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
    valid_until_date, sent_date,
    customer_name, customer_email, customer_phone,
    internal_notes, customer_notes
) VALUES
(
    'QT-2024-004',
    'Residential Electrical Panel Upgrade Quote',
    '200-amp electrical panel upgrade with new breakers and service connection',
    '{"task_id": "d1111111-1111-1111-1111-111111111111", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Draft',
    '[
        {"item_type":"service","item_code":"SVC-ELEC-001","item_name":"Electrical Panel Upgrade","quantity":1.0,"unit_rate":2800.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":2800.00,"tax_pct":13.00,"tax_amt":364.00,"line_total":3164.00,"line_notes":"200A panel upgrade with ESA inspection, permit application, and service connection"},
        {"item_type":"product","item_code":"PRD-ELEC-001","item_name":"Square D 200A Main Breaker Panel","quantity":1.0,"unit_rate":420.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":420.00,"tax_pct":13.00,"tax_amt":54.60,"line_total":474.60,"line_notes":"Square D 200A main breaker panel - 40 circuit spaces"},
        {"item_type":"product","item_code":"PRD-ELEC-003","item_name":"Romex Wire 14/2 250ft Roll","quantity":1.0,"unit_rate":95.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":95.00,"tax_pct":13.00,"tax_amt":12.35,"line_total":107.35,"line_notes":"Romex NMD90 wire 14/2 with ground - 250ft roll"}
    ]'::jsonb,
    3315.00, 0.00, 0.00, 13.00, 430.95, 3745.95,
    '2024-12-15', NULL,
    'Residential Customer D', 'customer.d@example.com', '905-555-0404',
    'Waiting on ESA inspection date before sending quote. Customer is aware permit required ($150 fee included).',
    'Price includes ESA permit application fee ($150) and inspection. Work must pass electrical safety inspection. HST (13%) included.'
);

-- Quote for Landscaping Design
INSERT INTO app.fact_quote (code, name, descr, metadata,
    dl__quote_stage,
    quote_items,
    subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
    valid_until_date, sent_date, accepted_date,
    customer_name, customer_email, customer_phone,
    internal_notes, customer_notes
) VALUES
(
    'QT-2024-005',
    'Custom Landscape Design & Installation Quote',
    'Custom landscape design with hardscaping, plantings, and irrigation system',
    '{"task_id": "b2222222-2222-2222-2222-222222222222", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Accepted',
    '[
        {"item_type":"service","item_code":"SVC-LAND-003","item_name":"Landscape Design & Installation","quantity":1.0,"unit_rate":5000.00,"discount_pct":10.00,"discount_amt":500.00,"subtotal":4500.00,"tax_pct":13.00,"tax_amt":585.00,"line_total":5085.00,"line_notes":"Phase 1: Hardscaping and irrigation system installation - 10% early booking discount"},
        {"item_type":"service","item_code":"SVC-LAND-002","item_name":"Lawn Care & Maintenance","quantity":12.0,"unit_rate":180.00,"discount_pct":15.00,"discount_amt":324.00,"subtotal":1836.00,"tax_pct":13.00,"tax_amt":238.68,"line_total":2074.68,"line_notes":"Weekly lawn maintenance for 3 months (April-June) - 15% prepay discount"},
        {"item_type":"product","item_code":"PRD-LAND-001","item_name":"Premium Mulch - Cubic Yard","quantity":15.0,"unit_rate":65.00,"discount_pct":8.00,"discount_amt":78.00,"subtotal":897.00,"tax_pct":13.00,"tax_amt":116.61,"line_total":1013.61,"line_notes":"Premium cedar mulch for planting beds - 15 cubic yards - 8% bulk discount"},
        {"item_type":"product","item_code":"PRD-LAND-003","item_name":"Irrigation Sprinkler Head - Pop-up 4 inch","quantity":24.0,"unit_rate":18.00,"discount_pct":5.00,"discount_amt":21.60,"subtotal":410.40,"tax_pct":13.00,"tax_amt":53.35,"line_total":463.75,"line_notes":"Hunter pop-up sprinkler heads - 4 inch (24 units) - 5% bulk discount"},
        {"item_type":"product","item_code":"PRD-LAND-002","item_name":"Lawn Fertilizer 50lb Bag","quantity":10.0,"unit_rate":48.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":480.00,"tax_pct":13.00,"tax_amt":62.40,"line_total":542.40,"line_notes":"Professional lawn fertilizer - 10 bags (50 lb each) for new grass areas"}
    ]'::jsonb,
    8123.40, 11.14, 923.60, 13.00, 1056.04, 9179.44,
    '2025-01-31', '2024-10-20', '2024-10-28',
    'Commercial Customer E', 'customer.e@business.com', '519-555-0505',
    'Large commercial project. Multiple discounts applied for off-season booking and bulk purchases. Phase 1 of 3-phase project.',
    'Total savings: $923.60 (11.1% overall). Project split into 3 phases. Phase 1 scheduled for spring 2025. HST (13%) included.'
);

-- Quote for Bathroom Renovation
INSERT INTO app.fact_quote (code, name, descr, metadata,
    dl__quote_stage,
    quote_items,
    subtotal_amt, discount_pct, discount_amt, tax_pct, quote_tax_amt, quote_total_amt,
    valid_until_date, sent_date,
    customer_name, customer_email, customer_phone,
    internal_notes, customer_notes
) VALUES
(
    'QT-2024-006',
    'Master Bathroom Renovation Quote',
    'Complete master bathroom renovation including plumbing, tiling, fixtures, and electrical',
    '{"task_id": "e1111111-1111-1111-1111-111111111111", "prepared_by": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"}'::jsonb,
    'Sent',
    '[
        {"item_type":"service","item_code":"SVC-PLUMB-001","item_name":"Plumbing Installation","quantity":1.0,"unit_rate":3200.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":3200.00,"tax_pct":13.00,"tax_amt":416.00,"line_total":3616.00,"line_notes":"Complete bathroom plumbing renovation - new supply lines, drains, and fixtures"},
        {"item_type":"service","item_code":"SVC-ELEC-003","item_name":"Lighting Installation","quantity":6.0,"unit_rate":450.00,"discount_pct":5.00,"discount_amt":135.00,"subtotal":2565.00,"tax_pct":13.00,"tax_amt":333.45,"line_total":2898.45,"line_notes":"Recessed LED lighting installation - 6 fixtures with dimmer controls - 5% multi-room discount"},
        {"item_type":"service","item_code":"SVC-GC-002","item_name":"Bathroom Renovation","quantity":1.0,"unit_rate":12000.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":12000.00,"tax_pct":13.00,"tax_amt":1560.00,"line_total":13560.00,"line_notes":"Complete bathroom renovation - general contracting, tiling, framing, drywall"},
        {"item_type":"product","item_code":"PRD-PLUMB-001","item_name":"Rheem 50-Gallon Water Heater","quantity":1.0,"unit_rate":650.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":650.00,"tax_pct":13.00,"tax_amt":84.50,"line_total":734.50,"line_notes":"Rheem 50-gallon electric water heater with 6-year warranty"},
        {"item_type":"product","item_code":"PRD-PLUMB-002","item_name":"Kohler Kitchen Faucet","quantity":2.0,"unit_rate":285.00,"discount_pct":5.00,"discount_amt":28.50,"subtotal":541.50,"tax_pct":13.00,"tax_amt":70.40,"line_total":611.90,"line_notes":"Kohler faucets - vanity and shower (brushed nickel) - 5% bundle discount"},
        {"item_type":"product","item_code":"PRD-ELEC-002","item_name":"LED Recessed Light 6 inch Kit","quantity":8.0,"unit_rate":42.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":336.00,"tax_pct":13.00,"tax_amt":43.68,"line_total":379.68,"line_notes":"LED recessed light kits - 6 inch with trim rings (8 units)"},
        {"item_type":"product","item_code":"PRD-GEN-003","item_name":"Ceramic Tile 12x12 Box","quantity":8.0,"unit_rate":45.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":360.00,"tax_pct":13.00,"tax_amt":46.80,"line_total":406.80,"line_notes":"Premium ceramic floor tile 12x12 - 8 boxes (96 sq ft coverage)"},
        {"item_type":"product","item_code":"PRD-GEN-001","item_name":"Premium Paint Gallon - Interior","quantity":4.0,"unit_rate":58.00,"discount_pct":0.00,"discount_amt":0.00,"subtotal":232.00,"tax_pct":13.00,"tax_amt":30.16,"line_total":262.16,"line_notes":"Benjamin Moore premium interior paint - 4 gallons (ceiling white and trim)"}
    ]'::jsonb,
    19884.50, 0.82, 163.50, 13.00, 2584.99, 22469.49,
    '2024-12-31', '2024-11-01',
    'Residential Customer F', 'customer.f@example.com', '416-555-0606',
    'High-end finishes requested. Applied minor discounts on electrical and fixtures. Customer considering options. Follow up weekly.',
    'Total savings: $163.50 (0.8%). Includes premium fixtures and materials. 12-month warranty on workmanship. Completion time: 6-8 weeks. HST (13%) included.'
);

COMMENT ON TABLE app.fact_quote IS 'Quote fact table with revenue tracking, stages, customer information, and JSONB line items';
