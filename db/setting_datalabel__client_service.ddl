-- ============================================================================
-- SETTING: CLIENT SERVICE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the catalog of services offered by Huron Home Services to clients.
--   This is a CLASSIFICATION table that categorizes the types of services
--   provided across residential, commercial, and industrial sectors. Services
--   can be linked to projects, tasks, pricing models, and client contracts.
--
-- Business Context:
--   Huron Home Services provides comprehensive home and property services
--   across multiple domains. Service categorization enables accurate project
--   scoping, resource allocation, pricing, and specialized team assignment.
--
-- Key Service Categories for Home Services:
--   - HVAC: Heating, ventilation, and air conditioning installation/maintenance
--   - Plumbing: Residential and commercial plumbing services
--   - Electrical: Electrical installation, repair, and maintenance
--   - Landscaping: Grounds maintenance, lawn care, and landscape design
--   - Roofing: Roof installation, repair, and inspection
--   - Pest Control: Integrated pest management services
--   - Cleaning: Commercial and residential cleaning services
--   - Snow Removal: Winter maintenance and snow clearing
--   - Painting: Interior and exterior painting services
--   - Carpentry: General carpentry and finish work
--   - Flooring: Floor installation, repair, and refinishing
--   - General Maintenance: Property maintenance and repairs
--
-- Integration Points:
--   - d_project.service_type references this table for project categorization
--   - d_task.service_type for task-level service tracking
--   - d_client contracts may specify approved services
--   - Pricing models and rate cards organized by service type
--   - Resource allocation based on service-specific skills
--   - Service-level agreements (SLAs) vary by service type
--
-- UI/UX Usage:
--   - Dropdown selector in project and task forms
--   - Filter option in project/task lists and reports
--   - Service-specific dashboard views
--   - Service performance analytics
--   - Resource capacity planning by service type
--
-- Data Characteristics:
--   - slug: URL-friendly identifier (e.g., 'hvac-maintenance')
--   - level_name: Display name (e.g., 'HVAC Maintenance')
--   - level_descr: Detailed service description
--   - sort_order: Display order in dropdowns and lists
--   - active_flag: Enable/disable services seasonally or strategically
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_client_service (
    level_id integer PRIMARY KEY,
    level_name varchar(100) NOT NULL UNIQUE,
    slug varchar(100) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for slug-based lookups
CREATE INDEX idx_client_service_slug ON app.setting_datalabel_client_service(slug);

-- Index for active services
CREATE INDEX idx_client_service_active ON app.setting_datalabel_client_service(active_flag) WHERE active_flag = true;

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Comprehensive service catalog for Huron Home Services
-- Covers residential, commercial, and industrial service offerings

INSERT INTO app.setting_datalabel_client_service (level_id, level_name, slug, level_descr, sort_order, active_flag) VALUES
(0, 'HVAC Installation', 'hvac-installation', 'Heating, ventilation, and air conditioning system installation for residential and commercial properties.', 0, true),
(1, 'HVAC Maintenance', 'hvac-maintenance', 'Preventive maintenance and repair services for HVAC systems. Includes seasonal tune-ups and system diagnostics.', 1, true),
(2, 'Plumbing Repair', 'plumbing-repair', 'Emergency and scheduled plumbing repairs including pipe repair, leak detection, and fixture replacement.', 2, true),
(3, 'Plumbing Installation', 'plumbing-installation', 'New plumbing system installation for renovations, new construction, and system upgrades.', 3, true),
(4, 'Electrical Repair', 'electrical-repair', 'Electrical system troubleshooting and repair services for residential and commercial properties.', 4, true),
(5, 'Electrical Installation', 'electrical-installation', 'New electrical system installation, panel upgrades, and lighting installation services.', 5, true),
(6, 'Landscaping Maintenance', 'landscaping-maintenance', 'Regular grounds maintenance including mowing, trimming, fertilization, and seasonal cleanup.', 6, true),
(7, 'Landscape Design', 'landscape-design', 'Professional landscape design and installation services for residential and commercial properties.', 7, true),
(8, 'Roofing Installation', 'roofing-installation', 'Complete roof installation services for residential and commercial properties. Multiple roofing materials available.', 8, true),
(9, 'Roofing Repair', 'roofing-repair', 'Roof repair services including leak repair, shingle replacement, and emergency storm damage repair.', 9, true),
(10, 'Pest Control', 'pest-control', 'Integrated pest management services for residential and commercial properties. Environmentally responsible solutions.', 10, true),
(11, 'Commercial Cleaning', 'commercial-cleaning', 'Professional cleaning services for offices, retail spaces, and commercial facilities. Daily, weekly, or custom schedules.', 11, true),
(12, 'Residential Cleaning', 'residential-cleaning', 'Comprehensive residential cleaning services including regular maintenance and deep cleaning.', 12, true),
(13, 'Snow Removal', 'snow-removal', 'Winter property maintenance including snow plowing, shoveling, and ice management services.', 13, true),
(14, 'Interior Painting', 'interior-painting', 'Professional interior painting services for residential and commercial properties. Preparation and finishing included.', 14, true),
(15, 'Exterior Painting', 'exterior-painting', 'Exterior painting and finishing services with weather-resistant coatings and surface preparation.', 15, true),
(16, 'Carpentry Services', 'carpentry-services', 'General carpentry including custom woodwork, trim installation, and finish carpentry.', 16, true),
(17, 'Flooring Installation', 'flooring-installation', 'Professional flooring installation including hardwood, laminate, tile, and carpet installation.', 17, true),
(18, 'Flooring Repair', 'flooring-repair', 'Floor repair and refinishing services for all floor types. Includes scratch repair and surface restoration.', 18, true),
(19, 'General Maintenance', 'general-maintenance', 'Comprehensive property maintenance and repair services. Handles miscellaneous repairs and upkeep.', 19, true),
(20, 'Window Installation', 'window-installation', 'Window replacement and installation services for residential and commercial properties. Energy-efficient options available.', 20, true),
(21, 'Door Installation', 'door-installation', 'Interior and exterior door installation including hardware and weather sealing.', 21, true),
(22, 'Appliance Repair', 'appliance-repair', 'Residential and commercial appliance repair services for major appliances.', 22, true),
(23, 'Gutter Services', 'gutter-services', 'Gutter cleaning, repair, and installation services. Includes downspout maintenance and leaf guard installation.', 23, true),
(24, 'Drywall Services', 'drywall-services', 'Drywall installation, repair, and finishing services for residential and commercial properties.', 24, true),
(25, 'Demolition Services', 'demolition-services', 'Controlled demolition and removal services for renovation projects. Includes debris removal and site cleanup.', 25, true);

COMMENT ON TABLE app.setting_datalabel_client_service IS 'Catalog of services offered by Huron Home Services to residential, commercial, and industrial clients';
COMMENT ON COLUMN app.setting_datalabel_client_service.slug IS 'URL-friendly identifier for service (e.g., hvac-maintenance)';
COMMENT ON COLUMN app.setting_datalabel_client_service.level_name IS 'Display name for the service type';
COMMENT ON COLUMN app.setting_datalabel_client_service.level_descr IS 'Detailed description of service scope and deliverables';
COMMENT ON COLUMN app.setting_datalabel_client_service.sort_order IS 'Display order in UI dropdowns and lists';
COMMENT ON COLUMN app.setting_datalabel_client_service.active_flag IS 'Indicates if service is currently offered (can be toggled seasonally or strategically)';
