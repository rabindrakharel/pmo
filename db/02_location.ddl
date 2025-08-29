-- ============================================================================
-- LOCATION SCOPE HIERARCHY (Geographic and Administrative Boundaries)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The location scope hierarchy represents the geographic and administrative 
-- organizational structure within which the PMO operates. It provides the 
-- foundational geographic context for all business operations, employee 
-- assignments, project deployments, and regulatory compliance requirements.
--
-- ARCHITECTURAL PURPOSE:
-- The d_scope_location table serves as the geographic backbone that enables:
--
-- • GEOGRAPHIC ORGANIZATION: Multi-level geographic hierarchy from corporate regions to cities
-- • REGULATORY COMPLIANCE: Location-based regulatory and tax jurisdiction management
-- • WORKFORCE DISTRIBUTION: Employee and resource allocation across geographic boundaries
-- • PROJECT DEPLOYMENT: Geographic scope definition for projects and operational activities
-- • COST CENTER MANAGEMENT: Location-based budgeting and financial reporting
-- • DISASTER RECOVERY: Geographic risk assessment and business continuity planning
--
-- CANADIAN ORGANIZATIONAL CONTEXT:
-- The hierarchy specifically supports Canadian business and governmental structures:
--
-- Level 1 (Corp-Region): North America, Europe, Asia-Pacific (Corporate Regions)
-- Level 2 (Country): Canada, United States, Mexico (National Boundaries)
-- Level 3 (Province): Ontario, Quebec, British Columbia (Provincial/State)
-- Level 4 (Region): Southern Ontario, Northern Quebec (Sub-Provincial Regions)
-- Level 5 (City): Toronto, Montreal, Vancouver (Municipal Level)
--
-- GEOSPATIAL INTEGRATION:
-- Each location can optionally include geospatial data (PostGIS geometry) for:
-- - Precise geographic coordinates and boundaries
-- - Spatial queries and distance calculations
-- - Geographic Information System (GIS) integration
-- - Location-based service optimization
-- - Proximity analysis for resource allocation
--
-- HIERARCHICAL INHERITANCE PATTERNS:
-- Location permissions and properties cascade through the hierarchy:
--
-- • PARENT PERMISSIONS: Access to parent location implies access to all children
-- • REGULATORY INHERITANCE: Tax codes and regulations flow from province to cities
-- • OPERATIONAL INHERITANCE: Corporate policies cascade from region to local offices
-- • RESOURCE INHERITANCE: Budget allocations and resource pools flow down hierarchy
--
-- MULTI-DIMENSIONAL INTEGRATION:
-- Location scopes integrate with other organizational dimensions:
--
-- • BUSINESS INTEGRATION: Worksites link locations to business units
-- • HR INTEGRATION: Employees assigned to specific locations through HR hierarchy
-- • PROJECT INTEGRATION: Projects scoped to specific geographic regions
-- • COMPLIANCE INTEGRATION: Location-specific regulatory requirements and reporting
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. MULTI-PROVINCIAL PROJECT:
--    - Project Manager has access to 'Ontario' location scope
--    - Automatically grants access to Toronto, London, Ottawa sub-locations
--    - Inherits provincial tax and regulatory compliance requirements
--    - Enables cross-city resource sharing and coordination
--
-- 2. REGIONAL SALES MANAGEMENT:
--    - Sales VP has access to 'Eastern Canada' region scope
--    - Includes Quebec, Ontario, and Maritime provinces
--    - Enables regional sales reporting and territory management
--    - Supports location-based customer relationship management
--
-- 3. REGULATORY COMPLIANCE:
--    - Privacy Officer has access to 'Canada' national scope
--    - Ensures PIPEDA compliance across all Canadian operations
--    - Manages provincial privacy variations (Quebec PPPA, etc.)
--    - Coordinates with international data transfer regulations
--
-- OPERATIONAL EFFICIENCY:
-- Location hierarchy enables operational optimizations:
-- - Resource sharing between nearby locations
-- - Travel cost optimization for cross-location projects
-- - Time zone coordination for distributed teams
-- - Local vendor and supplier management
-- - Cultural and language considerations (English/French in Canada)

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

CREATE TABLE app.d_scope_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
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
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_loc_level(level_id),
  parent_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  geom geometry(Geometry, 4326), -- PostGIS geometry for spatial operations
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_country_code CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_currency_code CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_language_primary CHECK (language_primary IN ('en', 'fr', 'es')),
  CONSTRAINT chk_time_zone CHECK (time_zone ~ '^[A-Za-z_]+/[A-Za-z_]+$')
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Canadian Location Hierarchy
INSERT INTO app.d_scope_location (name, "descr", addr, postal_code, country_code, province_code, time_zone, currency_code, language_primary, language_secondary, regulatory_region, tax_jurisdiction, from_ts, level_id, parent_id, tags, attr) VALUES

-- Corp Region Level (Level 1)
('North America', 'North American corporate region covering Canada, US, and Mexico', NULL, NULL, 'CA', NULL, 'America/Toronto', 'CAD', 'en', NULL, 'federal', '{"corporate_tax_rate": 15, "jurisdiction": "multinational"}'::jsonb, now(), 1, NULL, '["corporate", "region", "multinational"]', '{"headquarters": "Toronto", "established": "1995", "employee_count": 2500}'),

-- Country Level (Level 2)
('Canada', 'Dominion of Canada - Federal jurisdiction covering all provinces and territories', 'Parliament Hill, Ottawa, ON', 'K1A 0A6', 'CA', NULL, 'America/Toronto', 'CAD', 'en', 'fr', 'federal', '{"federal_tax_rate": 15, "gst_rate": 5, "jurisdiction": "federal"}'::jsonb, now(), 2, (SELECT id FROM app.d_scope_location WHERE name = 'North America'), '["country", "federal", "bilingual"]', '{"capital": "Ottawa", "confederation": "1867", "official_languages": ["English", "French"]}'),

-- Province Level (Level 3)
('Ontario', 'Province of Ontario - Most populous Canadian province', '2 Bloor St W, Toronto, ON', 'M7A 1A1', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'provincial', '{"provincial_tax_rate": 11.5, "hst_rate": 13, "jurisdiction": "provincial"}'::jsonb, now(), 3, (SELECT id FROM app.d_scope_location WHERE name = 'Canada'), '["province", "ontario", "economic-hub"]', '{"capital": "Toronto", "population": 14800000, "gdp_share": 39.0}'),

('Quebec', 'Province of Quebec - French-speaking province with distinct culture', '1045 Rue des Parlementaires, Quebec City, QC', 'G1A 1A3', 'CA', 'QC', 'America/Toronto', 'CAD', 'fr', 'en', 'provincial', '{"provincial_tax_rate": 9.975, "gst_rate": 5, "qst_rate": 9.975, "jurisdiction": "provincial"}'::jsonb, now(), 3, (SELECT id FROM app.d_scope_location WHERE name = 'Canada'), '["province", "quebec", "francophone"]', '{"capital": "Quebec City", "population": 8500000, "primary_language": "French"}'),

('British Columbia', 'Province of British Columbia - Pacific coast province', '501 Belleville St, Victoria, BC', 'V8V 1X4', 'CA', 'BC', 'America/Vancouver', 'CAD', 'en', NULL, 'provincial', '{"provincial_tax_rate": 7, "gst_rate": 5, "pst_rate": 7, "jurisdiction": "provincial"}'::jsonb, now(), 3, (SELECT id FROM app.d_scope_location WHERE name = 'Canada'), '["province", "bc", "pacific"]', '{"capital": "Victoria", "population": 5200000, "timezone": "Pacific"}'),

-- Regional Level (Level 4)
('Southern Ontario', 'Southern Ontario region including Greater Toronto Area and surrounding cities', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'regional', '{"regional_development_fund": true, "jurisdiction": "regional"}'::jsonb, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '["region", "gta", "economic-center"]', '{"major_cities": ["Toronto", "Hamilton", "London"], "economic_zone": "manufacturing_finance"}'),

('Northern Ontario', 'Northern Ontario region including mining and forestry communities', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'regional', '{"northern_development_fund": true, "jurisdiction": "regional"}'::jsonb, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '["region", "northern", "resource-based"]', '{"major_cities": ["Thunder Bay", "Sudbury", "Timmins"], "economic_zone": "mining_forestry"}'),

('Eastern Ontario', 'Eastern Ontario region including National Capital Region', NULL, NULL, 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'regional', '{"bilingual_services": true, "jurisdiction": "regional"}'::jsonb, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '["region", "eastern", "government"]', '{"major_cities": ["Ottawa", "Kingston"], "economic_zone": "government_technology"}'),

('Greater Montreal', 'Greater Montreal metropolitan region', NULL, NULL, 'CA', 'QC', 'America/Toronto', 'CAD', 'fr', 'en', 'regional', '{"metropolitan_tax": true, "jurisdiction": "regional"}'::jsonb, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Quebec'), '["region", "montreal", "metropolitan"]', '{"major_cities": ["Montreal", "Laval"], "economic_zone": "aerospace_technology"}'),

('Lower Mainland', 'Lower Mainland region including Vancouver metropolitan area', NULL, NULL, 'CA', 'BC', 'America/Vancouver', 'CAD', 'en', NULL, 'regional', '{"metro_vancouver_tax": true, "jurisdiction": "regional"}'::jsonb, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'British Columbia'), '["region", "vancouver", "pacific-gateway"]', '{"major_cities": ["Vancouver", "Burnaby", "Richmond"], "economic_zone": "trade_technology"}'),

-- City Level (Level 5)
('Toronto', 'City of Toronto - Provincial capital and largest Canadian city', '100 Queen St W, Toronto, ON', 'M5H 2N2', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'municipal', '{"property_tax_rate": 0.6, "municipal_land_transfer_tax": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Eastern Ontario'), '["city", "provincial-capital", "financial-center"]', '{"population": 2950000, "area_km2": 630, "established": "1834", "industries": ["finance", "technology", "media"]}'),

('London', 'City of London - Regional center in Southwestern Ontario', '300 Dufferin Ave, London, ON', 'N6A 4L9', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 1.4, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'), '["city", "regional-center", "education"]', '{"population": 422000, "area_km2": 420, "established": "1826", "industries": ["education", "healthcare", "manufacturing"]}'),

('Ottawa', 'City of Ottawa - National capital of Canada', '100 Sussex Dr, Ottawa, ON', 'K1A 0A6', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'municipal', '{"property_tax_rate": 1.2, "bilingual_services": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Eastern Ontario'), '["city", "national-capital", "government"]', '{"population": 1000000, "area_km2": 2790, "established": "1826", "industries": ["government", "technology", "tourism"]}'),

('Mississauga', 'City of Mississauga - Major suburban city in Greater Toronto Area', '300 City Centre Dr, Mississauga, ON', 'L5B 3C1', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', 'fr', 'municipal', '{"property_tax_rate": 0.9, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'), '["city", "suburban", "transportation-hub"]', '{"population": 750000, "area_km2": 292, "established": "1974", "industries": ["logistics", "corporate-headquarters", "retail"]}'),

('Hamilton', 'City of Hamilton - Steel city and port in Southern Ontario', '71 Main St W, Hamilton, ON', 'L8P 4Y5', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 1.3, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'), '["city", "industrial", "port"]', '{"population": 580000, "area_km2": 1138, "established": "1846", "industries": ["steel", "manufacturing", "healthcare"]}'),

('Thunder Bay', 'City of Thunder Bay - Regional center in Northwestern Ontario', '500 Donald St E, Thunder Bay, ON', 'P7E 5V3', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 1.8, "northern_tax_credit": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Northern Ontario'), '["city", "northern", "resource-center"]', '{"population": 110000, "area_km2": 328, "established": "1907", "industries": ["forestry", "mining", "transportation"]}'),

('Montreal', 'City of Montreal - Largest city in Quebec and cultural capital', '275 Rue Notre-Dame E, Montreal, QC', 'H2Y 1C6', 'CA', 'QC', 'America/Toronto', 'CAD', 'fr', 'en', 'municipal', '{"property_tax_rate": 0.7, "municipal_tax_variations": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Greater Montreal'), '["city", "cultural-capital", "bilingual"]', '{"population": 1800000, "area_km2": 365, "established": "1642", "industries": ["aerospace", "technology", "arts"]}'),

('Vancouver', 'City of Vancouver - Pacific gateway and major port city', '453 W 12th Ave, Vancouver, BC', 'V5Y 1V4', 'CA', 'BC', 'America/Vancouver', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 0.25, "foreign_buyer_tax": true, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Lower Mainland'), '["city", "pacific-gateway", "multicultural"]', '{"population": 675000, "area_km2": 115, "established": "1886", "industries": ["trade", "technology", "film"]}'),

('Barrie', 'City of Barrie - Growing city north of Toronto', '70 Collier St, Barrie, ON', 'L4M 4T5', 'CA', 'ON', 'America/Toronto', 'CAD', 'en', NULL, 'municipal', '{"property_tax_rate": 1.5, "jurisdiction": "municipal"}'::jsonb, now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Northern Ontario'), '["city", "commuter", "growing"]', '{"population": 150000, "area_km2": 99, "established": "1871", "industries": ["manufacturing", "services", "commuter-town"]}');

-- Indexes removed for simplified import