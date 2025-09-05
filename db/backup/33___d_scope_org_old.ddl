-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Location scope hierarchy representing geographic and administrative organizational 
-- structure for business operations, employee assignments, and regulatory compliance.
--
-- Hierarchy Structure:
-- • Corp-Region → Country → Province → Region → City → Address
-- Most granular: Address:  means the actual Address of the Corp campus. 
-- • Supports Canadian business and governmental structures
-- • Enables geographic permissions, regulatory compliance, and resource allocation
-- • Integrates with PostGIS for spatial operations

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_org (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Location-specific fields
  addr text, -- Physical address for cities/offices
  postal_code text, -- Postal/ZIP code for precise addressing
  country_code text DEFAULT 'CA', -- ISO 3166-1 alpha-2 country code
  province_code text, -- Province/state code (ON, QC, BC, etc.)
  time_zone text DEFAULT 'America/Toronto', -- IANA timezone identifier
  currency_code text DEFAULT 'CAD', -- ISO 4217 currency code
  language_primary text DEFAULT 'en', -- Primary language (en, fr)
  language_secondary text, -- Secondary language for bilingual regions
  regulatory_region text, -- Regulatory classification (federal, provincial, municipal)
  tax_jurisdiction jsonb DEFAULT '{}'::jsonb, -- Tax codes and rates
  emergency_contacts jsonb DEFAULT '[]'::jsonb, -- Emergency contact information
  level_id int NOT NULL REFERENCES app.meta_loc_level(level_id),
  level_name text NOT NULL,
  parent_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  geom geometry(Geometry, 4326) -- PostGIS geometry for spatial operations
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Canadian Location Hierarchy for Huron Home Services (Corrected levels: 0-7)
INSERT INTO app.d_scope_org (name, "descr", addr, postal_code, country_code, province_code, time_zone, currency_code, language_primary, language_secondary, regulatory_region, tax_jurisdiction, from_ts, level_id, level_name, parent_id, tags, attr) VALUES

-- Corp Region Level (Level 0)
('North America', 'North American corporate region covering Canada, US, and Mexico', NULL, NULL, 'CA', NULL, 'America/Toronto', 'CAD', 'en', NULL, 'federal', '{"corporate_tax_rate": 15, "jurisdiction": "multinational"}'::jsonb, now(), 0, 'Corp-Region', NULL, '["corporate", "region", "multinational"]', '{"headquarters": "Toronto", "established": "1995", "employee_count": 2500}'),

-- Country Level (Level 1)
('Canada', 'Dominion of Canada - Federal jurisdiction covering all provinces and territories', 'Parliament Hill, Ottawa, ON', 'K1A 0A6', 'CA', NULL, 'America/Toronto', 'CAD', 'en', 'fr', 'federal', '{"federal_tax_rate": 15, "gst_rate": 5, "jurisdiction": "federal"}'::jsonb, now(), 1, 'Country', (SELECT id FROM app.d_scope_org WHERE name = 'North America'), '["country", "federal", "bilingual"]', '{"capital": "Ottawa", "confederation": "1867", "official_languages": ["English", "French"]}'),

-- Province Level (Level 2)
('Ontario', 'Province of Ontario - Most populous Canadian province where Huron Home Services operates', '2 Bloor St W, Toronto, ON', 'M7A 1A1', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'provincial', '{"provincial_tax_rate": 11.5, "hst_rate": 13, "jurisdiction": "provincial"}'::jsonb, now(), 2, 'Province', (SELECT id FROM app.d_scope_org WHERE name = 'Canada'), '["province", "ontario", "economic-hub", "home-services-region"]', '{"capital": "Toronto", "population": 14800000, "gdp_share": 39.0, "huron_service_area": true}'),

-- Economic Region Level (Level 3)
('Southern Ontario', 'Southern Ontario region - Primary service area for Huron Home Services including GTA and surrounding cities', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'regional', '{"regional_development_fund": true, "jurisdiction": "regional"}'::jsonb, now(), 3, 'Economic Region', (SELECT id FROM app.d_scope_org WHERE name = 'Ontario'), '["region", "gta", "economic-center", "huron-primary-market"]', '{"major_cities": ["Toronto", "Mississauga", "Hamilton", "London"], "economic_zone": "manufacturing_finance_home_services", "huron_market_share": "15%"}'),

-- Metropolitan Area Level (Level 4)
('Greater Toronto Area', 'Greater Toronto Area metropolitan region - Core market for Huron Home Services', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'metropolitan', '{"metropolitan_tax": true, "jurisdiction": "metropolitan"}'::jsonb, now(), 4, 'Metropolitan Area', (SELECT id FROM app.d_scope_org WHERE name = 'Southern Ontario'), '["metropolitan", "gta", "core-market"]', '{"major_cities": ["Toronto", "Mississauga", "Brampton"], "economic_zone": "home_services_hub", "huron_offices": 2}'),

('London Metropolitan Area', 'London metropolitan area - Secondary market for Huron Home Services expansion', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'metropolitan', '{"regional_services": true, "jurisdiction": "metropolitan"}'::jsonb, now(), 4, 'Metropolitan Area', (SELECT id FROM app.d_scope_org WHERE name = 'Southern Ontario'), '["metropolitan", "london-region", "secondary-market"]', '{"major_cities": ["London", "St. Thomas"], "economic_zone": "education_healthcare_home_services", "huron_offices": 1}'),

-- City Level (Level 5) - Huron Home Services Office Locations
('Toronto', 'City of Toronto - Provincial capital and major Huron Home Services market', '100 Queen St W, Toronto, ON', 'M5H 2N2', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'municipal', '{"property_tax_rate": 0.6, "municipal_land_transfer_tax": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, 'City', (SELECT id FROM app.d_scope_org WHERE name = 'Greater Toronto Area'), '["city", "provincial-capital", "financial-center", "huron-market"]', '{"population": 2950000, "area_km2": 630, "established": "1834", "industries": ["finance", "technology", "media", "home_services"], "huron_service_demand": "high"}'),

('Mississauga', 'City of Mississauga - Huron Home Services headquarters and major service area', '300 City Centre Dr, Mississauga, ON', 'L5B 3C1', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'municipal', '{"property_tax_rate": 0.9, "jurisdiction": "municipal"}'::jsonb, now(), 5, 'City', (SELECT id FROM app.d_scope_org WHERE name = 'Greater Toronto Area'), '["city", "suburban", "transportation-hub", "huron-headquarters"]', '{"population": 750000, "area_km2": 292, "established": "1974", "industries": ["logistics", "corporate-headquarters", "retail", "home_services"], "huron_headquarters": true, "huron_employees": 75}'),

('London', 'City of London - Huron Home Services regional office and growing market', '300 Dufferin Ave, London, ON', 'N6A 4L9', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 1.4, "jurisdiction": "municipal"}'::jsonb, now(), 5, 'City', (SELECT id FROM app.d_scope_org WHERE name = 'London Metropolitan Area'), '["city", "regional-center", "education", "huron-expansion"]', '{"population": 422000, "area_km2": 420, "established": "1826", "industries": ["education", "healthcare", "manufacturing", "home_services"], "huron_regional_office": true, "huron_employees": 25}'),

-- District Level (Level 6) - Huron Service Districts
('Mississauga Central', 'Central Mississauga district - High-density residential area with strong demand for home services', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'district', '{"service_district": true, "jurisdiction": "municipal"}'::jsonb, now(), 6, 'District', (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga'), '["district", "residential", "high-density", "prime-service-area"]', '{"household_density": "high", "income_level": "upper-middle", "service_demand": "year_round", "huron_contractors": 15}'),

('Toronto North York', 'North York district - Suburban Toronto area with mixed residential and commercial properties', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'district', '{"service_district": true, "jurisdiction": "municipal"}'::jsonb, now(), 6, 'District', (SELECT id FROM app.d_scope_org WHERE name = 'Toronto'), '["district", "suburban", "mixed-use", "growing-market"]', '{"household_density": "medium-high", "property_types": ["single_family", "townhouse", "condo"], "service_demand": "seasonal_peaks", "huron_contractors": 12}'),

('London East', 'East London district - Established residential neighborhoods with mature landscaping needs', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'district', '{"service_district": true, "jurisdiction": "municipal"}'::jsonb, now(), 6, 'District', (SELECT id FROM app.d_scope_org WHERE name = 'London'), '["district", "established", "mature-properties", "steady-market"]', '{"household_density": "medium", "property_age": "mature", "service_demand": "maintenance_focused", "huron_contractors": 8}'),

-- Address Level (Level 7) - Huron Office Locations
('1250 South Service Rd, Mississauga, ON L5E 1V4', 'Huron Home Services Corporate Headquarters - Main office, dispatch center, and equipment depot', '1250 South Service Rd', 'L5E 1V4', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'office', '{"office_space_tax": true, "commercial_district": true, "jurisdiction": "municipal"}'::jsonb, now(), 7, 'Address', (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga Central'), '["address", "headquarters", "office", "depot"]', '{"building_type": "commercial", "office_size_sqft": 15000, "depot_size_sqft": 8000, "parking_spaces": 50, "equipment_storage": true, "dispatch_center": true}'),

('85 Bentley Ave, Toronto, ON M6N 2W7', 'Huron Home Services Toronto Branch - Customer service center and equipment staging', '85 Bentley Ave', 'M6N 2W7', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'office', '{"commercial_tax": true, "jurisdiction": "municipal"}'::jsonb, now(), 7, 'Address', (SELECT id FROM app.d_scope_org WHERE name = 'Toronto North York'), '["address", "branch-office", "customer-service", "staging"]', '{"building_type": "industrial", "office_size_sqft": 8000, "staging_area_sqft": 5000, "parking_spaces": 25, "customer_entrance": true, "equipment_staging": true}'),

('467 Talbot St, London, ON N6A 2S5', 'Huron Home Services London Office - Regional operations and local contractor coordination', '467 Talbot St', 'N6A 2S5', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'office', '{"commercial_tax": true, "jurisdiction": "municipal"}'::jsonb, now(), 7, 'Address', (SELECT id FROM app.d_scope_org WHERE name = 'London East'), '["address", "regional-office", "operations", "contractor-hub"]', '{"building_type": "office", "office_size_sqft": 4500, "meeting_rooms": 3, "parking_spaces": 15, "contractor_base": true, "regional_coordination": true}');

-- Indexes removed for simplified import