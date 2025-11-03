-- =====================================================
-- SERVICE ENTITY (d_service) - DIMENSION
-- Service catalog for quotes and work orders
-- =====================================================
--
-- SEMANTICS:
-- Services represent the types of work offered by Huron Home Services.
-- Used in quotes and work orders to specify what services are being provided.
-- Each service has pricing, duration estimates, and service category metadata.
-- In-place updates (same ID, version++), soft delete preserves historical data.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with version=1, active_flag=true
--   Example: INSERT INTO d_service (id, code, name, descr, service_category,
--                                    standard_rate_amt, estimated_hours)
--            VALUES ('s1111111-...', 'SVC-HVAC-001', 'HVAC Installation',
--                    'Complete HVAC system installation', 'HVAC', 2500.00, 8.0)
--
-- • UPDATE: Same ID, version++, updated_ts refreshes
--   Example: UPDATE d_service SET standard_rate_amt=2750.00, version=version+1
--            WHERE id='s1111111-...'
--
-- • SOFT DELETE: active_flag=false, to_ts=now()
--   Example: UPDATE d_service SET active_flag=false, to_ts=now() WHERE id='s1111111-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable, never changes)
-- • code: varchar(50) UNIQUE NOT NULL (business identifier: 'SVC-HVAC-001')
-- • name: text NOT NULL (display name: 'HVAC Installation')
-- • service_category: text ('HVAC', 'Plumbing', 'Electrical', 'Landscaping', etc.)
-- • standard_rate_amt: decimal(15,2) (standard pricing per service)
-- • estimated_hours: numeric(10,2) (typical time to complete)
-- • minimum_charge_amt: decimal(15,2) (minimum charge for this service)
-- • taxable_flag: boolean (whether service is subject to tax)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: None (dimension entity)
-- • Children: fact_quote (via rel_quote_service), fact_work_order (via work order details)
--
-- USAGE:
-- • Quoted services: rel_quote_service links quotes to services
-- • Work order services: Tracks actual services performed
-- • Service catalog: Browse available services with standard rates
--
-- =====================================================

CREATE TABLE app.d_service (
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

    -- Service-specific fields
    service_category text, -- HVAC, Plumbing, Electrical, Landscaping, General Contracting, etc.
    standard_rate_amt decimal(15,2), -- Standard rate for this service
    estimated_hours numeric(10,2), -- Typical hours to complete
    minimum_charge_amt decimal(15,2), -- Minimum charge regardless of time
    taxable_flag boolean DEFAULT true, -- Is this service taxable?
    requires_certification_flag boolean DEFAULT false -- Requires certified technician?
);

COMMENT ON TABLE app.d_service IS 'Service catalog for quotes and work orders';

-- =====================================================
-- DATA CURATION: Sample Services for Huron Home Services
-- =====================================================

-- HVAC Services
INSERT INTO app.d_service (code, name, descr, metadata,
    service_category, standard_rate_amt, estimated_hours, minimum_charge_amt,
    taxable_flag, requires_certification_flag
) VALUES
(
    'SVC-HVAC-001',
    'HVAC System Installation',
    'Complete installation of new HVAC system including ductwork, thermostat, and system commissioning',
    '{"skill_level": "advanced", "equipment_required": ["crane", "tools"], "warranty_months": 24}'::jsonb,
    'HVAC', 5500.00, 16.0, 1000.00, true, true
),
(
    'SVC-HVAC-002',
    'HVAC Maintenance Service',
    'Routine HVAC system maintenance including filter replacement, system inspection, and performance testing',
    '{"skill_level": "intermediate", "frequency": "quarterly", "warranty_months": 3}'::jsonb,
    'HVAC', 250.00, 2.0, 150.00, true, false
),
(
    'SVC-HVAC-003',
    'Emergency HVAC Repair',
    'Emergency HVAC system repair service with same-day response for critical system failures',
    '{"skill_level": "advanced", "priority": "emergency", "response_time_hours": 4}'::jsonb,
    'HVAC', 450.00, 3.0, 300.00, true, true
);

-- Plumbing Services
INSERT INTO app.d_service (code, name, descr, metadata,
    service_category, standard_rate_amt, estimated_hours, minimum_charge_amt,
    taxable_flag, requires_certification_flag
) VALUES
(
    'SVC-PLUMB-001',
    'Plumbing Installation',
    'Complete plumbing installation for new construction or renovation projects',
    '{"skill_level": "advanced", "equipment_required": ["pipe_threading", "soldering"], "warranty_months": 12}'::jsonb,
    'Plumbing', 3200.00, 12.0, 800.00, true, true
),
(
    'SVC-PLUMB-002',
    'Drain Cleaning Service',
    'Professional drain cleaning service using power augers and hydro-jetting equipment',
    '{"skill_level": "intermediate", "equipment_required": ["auger", "hydro_jet"], "warranty_months": 1}'::jsonb,
    'Plumbing', 350.00, 2.5, 200.00, true, false
),
(
    'SVC-PLUMB-003',
    'Water Heater Replacement',
    'Complete water heater replacement including removal of old unit and installation of new unit',
    '{"skill_level": "advanced", "equipment_required": ["dolly", "tools"], "warranty_months": 12}'::jsonb,
    'Plumbing', 1800.00, 6.0, 600.00, true, true
);

-- Electrical Services
INSERT INTO app.d_service (code, name, descr, metadata,
    service_category, standard_rate_amt, estimated_hours, minimum_charge_amt,
    taxable_flag, requires_certification_flag
) VALUES
(
    'SVC-ELEC-001',
    'Electrical Panel Upgrade',
    'Upgrade electrical service panel to modern standards including new breakers and wiring',
    '{"skill_level": "advanced", "equipment_required": ["meters", "tools"], "warranty_months": 24, "permit_required": true}'::jsonb,
    'Electrical', 2800.00, 10.0, 1000.00, true, true
),
(
    'SVC-ELEC-002',
    'Residential Wiring',
    'Complete residential electrical wiring for new construction or renovations',
    '{"skill_level": "advanced", "equipment_required": ["wire_pullers", "tools"], "warranty_months": 12, "permit_required": true}'::jsonb,
    'Electrical', 4200.00, 16.0, 1200.00, true, true
),
(
    'SVC-ELEC-003',
    'Lighting Installation',
    'Installation of interior and exterior lighting fixtures',
    '{"skill_level": "intermediate", "equipment_required": ["ladder", "tools"], "warranty_months": 6}'::jsonb,
    'Electrical', 450.00, 3.0, 150.00, true, true
);

-- Landscaping Services
INSERT INTO app.d_service (code, name, descr, metadata,
    service_category, standard_rate_amt, estimated_hours, minimum_charge_amt,
    taxable_flag, requires_certification_flag
) VALUES
(
    'SVC-LAND-001',
    'Fall Cleanup Service',
    'Comprehensive fall cleanup including leaf removal, garden bed preparation, and winterization',
    '{"skill_level": "basic", "equipment_required": ["blowers", "rakes"], "seasonal": true, "season": "fall"}'::jsonb,
    'Landscaping', 600.00, 6.0, 200.00, true, false
),
(
    'SVC-LAND-002',
    'Lawn Care & Maintenance',
    'Regular lawn care including mowing, edging, trimming, and fertilization',
    '{"skill_level": "basic", "equipment_required": ["mower", "trimmer", "edger"], "frequency": "weekly"}'::jsonb,
    'Landscaping', 180.00, 2.0, 100.00, true, false
),
(
    'SVC-LAND-003',
    'Landscape Design & Installation',
    'Custom landscape design and installation including plants, hardscaping, and irrigation',
    '{"skill_level": "advanced", "equipment_required": ["excavator", "tools"], "warranty_months": 6}'::jsonb,
    'Landscaping', 5000.00, 40.0, 2000.00, true, false
);

-- General Contracting Services
INSERT INTO app.d_service (code, name, descr, metadata,
    service_category, standard_rate_amt, estimated_hours, minimum_charge_amt,
    taxable_flag, requires_certification_flag
) VALUES
(
    'SVC-GC-001',
    'Kitchen Renovation',
    'Complete kitchen renovation including cabinets, countertops, flooring, and fixtures',
    '{"skill_level": "advanced", "equipment_required": ["various"], "warranty_months": 12, "permit_required": true}'::jsonb,
    'General Contracting', 18000.00, 120.0, 5000.00, true, false
),
(
    'SVC-GC-002',
    'Bathroom Renovation',
    'Complete bathroom renovation including plumbing, tiling, fixtures, and ventilation',
    '{"skill_level": "advanced", "equipment_required": ["various"], "warranty_months": 12, "permit_required": true}'::jsonb,
    'General Contracting', 12000.00, 80.0, 4000.00, true, false
),
(
    'SVC-GC-003',
    'Deck Construction',
    'Design and construction of outdoor deck including materials, railing, and stairs',
    '{"skill_level": "advanced", "equipment_required": ["saws", "drills"], "warranty_months": 24, "permit_required": true}'::jsonb,
    'General Contracting', 8500.00, 60.0, 3000.00, true, false
);

COMMENT ON TABLE app.d_service IS 'Service catalog for quotes and work orders with standard rates and estimates';
