-- =====================================================
-- WORK ORDER FACT TABLE (f_work_order)
-- Actual work performed for customers
-- =====================================================
--
-- SEMANTICS:
-- Work orders represent actual work performed, often following accepted quotes.
-- Tracks services rendered, products used, labor hours, and completion status.
-- Work orders can be linked to quotes or created independently for service calls.
-- In-place updates (same ID, version++), soft delete preserves historical data.
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/work-order, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/work-order/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/work-order, filters by dl__work_order_status/technician, RBAC enforced
-- • STATUS TRANSITIONS: Scheduled → In Progress → Completed
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: task (via entity_instance_link)
-- • Related: quote (via metadata or separate linker if needed)
-- • Uses: service, product (tracked in metadata or via line items)
--
-- DATALABEL INTEGRATION:
-- • dl__work_order_status: setting_datalabel WHERE datalabel_name='dl__work_order_status'
-- • Frontend renders: Colored badges, status progression, scheduling interface
--
-- =====================================================

CREATE TABLE app.work_order (
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

    -- Work order specific fields
    dl__work_order_status text, -- References app.setting_datalabel (datalabel_name='dl__work_order_status')

    -- Scheduling and assignment
    scheduled_date date, -- Scheduled work date
    scheduled_start_time time, -- Scheduled start time
    scheduled_end_time time, -- Scheduled end time
    assigned_technician_name text, -- Assigned technician(s)
    assigned_technician_ids uuid[], -- Array of employee IDs

    -- Actual work tracking
    started_ts timestamptz, -- Actual start timestamp
    completed_ts timestamptz, -- Actual completion timestamp
    labor_hours numeric(10,2) DEFAULT 0.00, -- Actual labor hours worked

    -- Financial tracking
    labor_cost_amt decimal(15,2) DEFAULT 0.00, -- Labor cost
    materials_cost_amt decimal(15,2) DEFAULT 0.00, -- Materials/products cost
    total_cost_amt decimal(15,2) DEFAULT 0.00, -- Total work order cost

    -- Customer information
    customer_name text, -- Customer name for quick reference
    customer_email text, -- Customer contact email
    customer_phone text, -- Customer contact phone
    service_address_line1 text, -- Service location address
    service_address_line2 text,
    service_city text,
    service_province text DEFAULT 'Ontario',
    service_postal_code text,

    -- Completion tracking
    customer_signature_flag boolean DEFAULT false, -- Customer signed completion
    customer_satisfaction_rating integer, -- 1-5 rating
    completion_notes text, -- Notes about completion
    follow_up_required_flag boolean DEFAULT false, -- Requires follow-up?
    follow_up_date date, -- Scheduled follow-up date

    -- Internal notes
    internal_notes text, -- Internal notes not visible to customer
    special_instructions text -- Special instructions for technicians
);

COMMENT ON TABLE app.fact_work_order IS 'Work order fact table tracking actual work performed for customers';

-- =====================================================
-- DATA CURATION: Sample Work Orders
-- =====================================================

-- Work Order for HVAC Installation (From Quote QT-2024-001)
INSERT INTO app.fact_work_order (code, name, descr, metadata,
    dl__work_order_status,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    assigned_technician_name, assigned_technician_ids,
    started_ts, completed_ts, labor_hours,
    labor_cost_amt, materials_cost_amt, total_cost_amt,
    customer_name, customer_email, customer_phone,
    service_address_line1, service_city, service_province, service_postal_code,
    customer_signature_flag, customer_satisfaction_rating, completion_notes,
    follow_up_required_flag, follow_up_date,
    internal_notes, special_instructions
) VALUES
(
    'WO-2024-001',
    'HVAC System Installation - Complete',
    'Complete HVAC system installation per quote QT-2024-001. Includes 3-ton Carrier unit, smart thermostat, and ductwork modifications.',
    '{"quote_id": "q1111111-1111-1111-1111-111111111111", "task_id": "a2222222-2222-2222-2222-222222222222", "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "services": ["s1111111-1111-1111-1111-111111111111"], "products": ["p1111111-1111-1111-1111-111111111111", "p1111112-1111-1111-1111-111111111112"]}'::jsonb,
    'Completed',
    '2024-11-15', '08:00:00', '17:00:00',
    'HVAC Team Lead', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    '2024-11-15 08:15:00', '2024-11-15 16:45:00', 16.5,
    5500.00, 3420.00, 8920.00,
    'Residential Customer A', 'customer.a@example.com', '519-555-0101',
    '123 Maple Street', 'London', 'Ontario', 'N6A 1B2',
    true, 5, 'Installation completed successfully. Customer very satisfied with work quality and professionalism.',
    true, '2024-12-15',
    'Used premium grade refrigerant lines. System tested and commissioned per manufacturer specs.',
    'Customer has two small dogs - keep doors closed. Park in driveway, not on street.'
),
(
    'WO-2024-002',
    'Fall Landscaping - Phase 1',
    'Fall cleanup service phase 1 of 4 - initial leaf removal and garden bed cleanup',
    '{"quote_id": "q1111112-1111-1111-1111-111111111112", "task_id": "b1111111-1111-1111-1111-111111111111", "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f", "services": ["s4444441-4444-4444-4444-444444444441"]}'::jsonb,
    'Completed',
    '2024-10-28', '09:00:00', '15:00:00',
    'Landscaping Crew Alpha', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    '2024-10-28 09:10:00', '2024-10-28 14:50:00', 11.5,
    600.00, 195.00, 795.00,
    'Commercial Property Manager B', 'manager.b@commercial.com', '416-555-0202',
    '456 Business Park Drive', 'Toronto', 'Ontario', 'M5H 2N2',
    true, 4, 'Phase 1 completed. Some areas need additional attention in Phase 2.',
    false, NULL,
    'North section has drainage issue - noted for future landscaping project.',
    'Property manager on-site 9am-12pm. Gate code: 4782. Park in visitor lot.'
);

-- Work Order for Emergency HVAC Repair
INSERT INTO app.fact_work_order (code, name, descr, metadata,
    dl__work_order_status,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    assigned_technician_name, assigned_technician_ids,
    started_ts, completed_ts, labor_hours,
    labor_cost_amt, materials_cost_amt, total_cost_amt,
    customer_name, customer_email, customer_phone,
    service_address_line1, service_city, service_province, service_postal_code,
    customer_signature_flag, customer_satisfaction_rating, completion_notes,
    follow_up_required_flag,
    internal_notes, special_instructions
) VALUES
(
    'WO-2024-003',
    'Emergency HVAC Repair - No Heat',
    'Emergency service call for non-functioning furnace. Customer without heat.',
    '{"priority": "emergency", "services": ["s1111113-1111-1111-1111-111111111113"], "products": ["p1111113-1111-1111-1111-111111111113"]}'::jsonb,
    'Completed',
    '2024-11-01', '14:00:00', '17:00:00',
    'Senior HVAC Technician', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    '2024-11-01 14:20:00', '2024-11-01 16:40:00', 4.5,
    450.00, 85.00, 535.00,
    'Residential Customer G', 'customer.g@example.com', '519-555-0707',
    '789 Oak Avenue', 'London', 'Ontario', 'N6B 2C3',
    true, 5, 'Replaced clogged air filter and reset system. Heat restored. Recommended annual maintenance plan.',
    true,
    'Filter was severely clogged - likely cause of system shutdown. Educated customer on filter replacement schedule.',
    'Emergency call - waive trip charge if customer signs maintenance agreement.'
);

-- Work Order for Plumbing Service
INSERT INTO app.fact_work_order (code, name, descr, metadata,
    dl__work_order_status,
    scheduled_date, scheduled_start_time,
    assigned_technician_name, assigned_technician_ids,
    started_ts, labor_hours,
    labor_cost_amt, materials_cost_amt, total_cost_amt,
    customer_name, customer_email, customer_phone,
    service_address_line1, service_city, service_province, service_postal_code,
    customer_signature_flag,
    internal_notes, special_instructions
) VALUES
(
    'WO-2024-004',
    'Drain Cleaning - Kitchen Sink',
    'Kitchen sink drain cleaning service - slow draining issue',
    '{"services": ["s2222222-2222-2222-2222-222222222222"]}'::jsonb,
    'In Progress',
    '2024-11-02', '10:00:00',
    'Master Plumber', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    '2024-11-02 10:15:00', 2.0,
    350.00, 0.00, 350.00,
    'Residential Customer H', 'customer.h@example.com', '647-555-0808',
    '321 Pine Road', 'Mississauga', 'Ontario', 'L5A 3E4',
    false,
    'Customer mentioned occasional gurgling sounds. Check main drain line and vent.',
    'Small apartment - limited workspace. Bring drop cloths.'
);

-- Work Order for Electrical Panel Upgrade (Scheduled)
INSERT INTO app.fact_work_order (code, name, descr, metadata,
    dl__work_order_status,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    assigned_technician_name, assigned_technician_ids,
    labor_cost_amt, materials_cost_amt, total_cost_amt,
    customer_name, customer_email, customer_phone,
    service_address_line1, service_city, service_province, service_postal_code,
    internal_notes, special_instructions
) VALUES
(
    'WO-2024-005',
    'Electrical Panel Upgrade - 200A',
    '200-amp electrical panel upgrade with new breakers and service connection',
    '{"quote_id": "q3333331-3333-3333-3333-333333333331", "services": ["s3333331-3333-3333-3333-333333333331"], "products": ["p3333331-3333-3333-3333-333333333331"], "permit_number": "EP-2024-1156"}'::jsonb,
    'Scheduled',
    '2024-11-20', '08:00:00', '16:00:00',
    'Master Electrician', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    2800.00, 620.00, 3420.00,
    'Residential Customer D', 'customer.d@example.com', '905-555-0404',
    '654 Elm Street', 'Hamilton', 'Ontario', 'L8N 2Z7',
    'ESA permit approved. Inspector scheduled for same day 3pm. Customer aware power will be off 2-3 hours.',
    'Elderly customer - be extra patient and explain work clearly. Park on street - driveway being repaved.'
);

-- Work Order for Landscape Installation (Scheduled Future)
INSERT INTO app.fact_work_order (code, name, descr, metadata,
    dl__work_order_status,
    scheduled_date, scheduled_start_time, scheduled_end_time,
    assigned_technician_name, assigned_technician_ids,
    labor_cost_amt, materials_cost_amt, total_cost_amt,
    customer_name, customer_email, customer_phone,
    service_address_line1, service_city, service_province, service_postal_code,
    internal_notes, special_instructions
) VALUES
(
    'WO-2025-001',
    'Landscape Design Installation - Phase 1',
    'Phase 1 of custom landscape installation - hardscaping and irrigation system',
    '{"quote_id": "q4444441-4444-4444-4444-444444444441", "phase": 1, "total_phases": 3, "services": ["s4444443-4444-4444-4444-444444444443"]}'::jsonb,
    'Scheduled',
    '2025-04-15', '07:00:00', '17:00:00',
    'Landscape Design Team', ARRAY['8260b1b0-5efc-4611-ad33-ee76c0cf7f13']::uuid[],
    5000.00, 7500.00, 12500.00,
    'Commercial Customer E', 'customer.e@business.com', '519-555-0505',
    '999 Corporate Boulevard', 'London', 'Ontario', 'N6E 2S8',
    'Large commercial project. Weather-dependent start date. Equipment rental scheduled.',
    'Coordinate with building management for site access. Excavator delivery arranged for 6am.'
);

COMMENT ON TABLE app.fact_work_order IS 'Work order fact table tracking actual services performed and completion status';
