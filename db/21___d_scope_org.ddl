-- ============================================================================
-- ORG SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Geographic org hierarchy dimension representing the complete
--   Canadian geographic structure from Corp-Region (level 0) through
--   Address (level 7). Provides foundation for org-based operations,
--   service delivery, and regulatory compliance across jurisdictions.
--
-- Scope Levels:
--   Level 0: Corp-Region - Corporate regional division spanning multiple countries
--   Level 1: Country - National boundary with federal jurisdiction
--   Level 2: Province - Provincial/territorial division with legislative authority
--   Level 3: Economic Region - Statistics Canada economic region
--   Level 4: Metropolitan Area - Census metropolitan area or agglomeration
--   Level 5: City - Municipal corporation with local government
--   Level 6: District - Municipal district or neighbourhood
--   Level 7: Address - Specific street address and postal code
--
-- Integration:
--   - References meta_org_level table for level definitions
--   - Supports geographic reporting and jurisdictional compliance
--   - Enables org-based service delivery and resource alorg
--   - Facilitates regulatory compliance across multiple jurisdictions

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_org (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),

  -- Org hierarchy fields
  org_code text,
  level_id int NOT NULL REFERENCES app.meta_org_level(level_id),
  level_name text NOT NULL,
  parent_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  
  -- Geographic attributes
  is_leaf_level boolean NOT NULL DEFAULT false,
  country_code text DEFAULT 'CA',
  province_code text,
  postal_code text,
  time_zone text DEFAULT 'America/Toronto',
  
  -- Coordinates and boundaries
  latitude numeric(10,7),
  longitude numeric(10,7),
  geom geometry(Geometry, 4326),
  
  -- Administrative attributes
  stats_can_code text,
  municipal_code text,
  service_area boolean DEFAULT false,
  regulatory_jurisdiction text
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Canadian Geographic Hierarchy - Huron Home Services Service Area

-- Corp-Region Level (Level 0)
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, time_zone, service_area, regulatory_jurisdiction, tags, attr) VALUES
('North America Central', 'Corporate regional division covering central North America including Ontario, Quebec, and adjacent US states', 'NAC', 0, 'Corp-Region', NULL, false, 'CA', 'America/Toronto', true, 'multi-national', '["corp-region", "north-america", "central", "multi-jurisdictional"]', '{"timezone_span": ["America/Toronto", "America/New_York"], "countries": ["CA", "US"], "primary_markets": ["Ontario", "Quebec", "New York", "Michigan"], "coordination_complexity": "high"}');

-- Country Level (Level 1)
WITH corp_region AS (SELECT id FROM app.d_scope_org WHERE name = 'North America Central')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, time_zone, service_area, regulatory_jurisdiction, tags, attr)
SELECT 
  'Canada',
  'Federal jurisdiction with provincial/territorial subdivisions, primary market for Huron Home Services operations',
  'CA',
  1,
  'Country',
  corp_region.id,
  false,
  'CA',
  'America/Toronto',
  true,
  'federal',
  '["country", "canada", "federal", "primary-market"]'::jsonb,
  '{"federal_jurisdiction": true, "currency": "CAD", "languages": ["en", "fr"], "tax_system": "federal_provincial", "healthcare": "universal", "business_registration": "federal_provincial"}'::jsonb
FROM corp_region;

-- Province Level (Level 2)
WITH canada AS (SELECT id FROM app.d_scope_org WHERE name = 'Canada')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, time_zone, service_area, regulatory_jurisdiction, tags, attr)
SELECT 
  'Ontario',
  'Province of Ontario - primary service area with headquarters in Mississauga and service coverage across the Golden Horseshoe',
  'ON',
  2,
  'Province',
  canada.id,
  false,
  'CA',
  'ON',
  'America/Toronto',
  true,
  'provincial',
  '["province", "ontario", "primary", "headquarters"]'::jsonb,
  '{"capital": "Toronto", "largest_city": "Toronto", "population": 14826276, "area_km2": 1076395, "gdp_cad_billion": 857.4, "major_industries": ["manufacturing", "services", "technology", "agriculture"], "business_environment": "favorable"}'::jsonb
FROM canada;

-- Economic Region Level (Level 3)
WITH ontario AS (SELECT id FROM app.d_scope_org WHERE name = 'Ontario')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, time_zone, service_area, regulatory_jurisdiction, stats_can_code, tags, attr)
SELECT 
  'Greater Toronto Area',
  'Statistics Canada economic region encompassing the Greater Toronto Area - core service delivery region for all business lines',
  'GTA',
  3,
  'Economic Region',
  ontario.id,
  false,
  'CA',
  'ON',
  'America/Toronto',
  true,
  'economic-region',
  '3520',
  '["economic-region", "gta", "core-market", "high-density"]'::jsonb,
  '{"statscan_er": "3520", "population": 6711985, "area_km2": 7124, "population_density": 942.3, "economic_base": ["finance", "technology", "manufacturing", "services"], "market_potential": "high"}'::jsonb
FROM ontario

UNION ALL

SELECT 
  'Hamilton-Niagara Peninsula',
  'Economic region covering Hamilton, St. Catharines-Niagara, and surrounding areas - secondary service market with growth potential',
  'HNP',
  3,
  'Economic Region',
  ontario.id,
  false,
  'CA',
  'ON',
  'America/Toronto',
  true,
  'economic-region',
  '3529',
  '["economic-region", "hamilton", "niagara", "secondary-market"]'::jsonb,
  '{"statscan_er": "3529", "population": 1406385, "area_km2": 4169, "economic_base": ["manufacturing", "agriculture", "tourism"], "market_potential": "medium"}'::jsonb
FROM ontario;

-- Metropolitan Area Level (Level 4)
WITH gta AS (SELECT id FROM app.d_scope_org WHERE name = 'Greater Toronto Area')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, time_zone, service_area, regulatory_jurisdiction, stats_can_code, tags, attr)
SELECT 
  'Toronto CMA',
  'Census Metropolitan Area of Toronto - highest density service area with premium market segments and competitive landscape',
  'TOR-CMA',
  4,
  'Metropolitan Area',
  gta.id,
  false,
  'CA',
  'ON',
  'America/Toronto',
  true,
  'metropolitan',
  '35535',
  '["cma", "toronto", "high-density", "premium-market"]'::jsonb,
  '{"statscan_cma": "35535", "population": 6202225, "area_km2": 5906, "core_city": "Toronto", "competition_level": "high", "market_maturity": "mature", "service_premium": true}'::jsonb
FROM gta

UNION ALL

SELECT 
  'Hamilton CMA',
  'Census Metropolitan Area of Hamilton - growing market with industrial base and residential expansion opportunities',
  'HAM-CMA',
  4,
  'Metropolitan Area',
  gta.id,
  false,
  'CA',
  'ON',
  'America/Toronto',
  true,
  'metropolitan',
  '35537',
  '["cma", "hamilton", "industrial", "growth-market"]'::jsonb,
  '{"statscan_cma": "35537", "population": 767000, "area_km2": 1372, "core_city": "Hamilton", "growth_rate": "moderate", "industrial_base": true, "residential_expansion": true}'::jsonb
FROM gta;

-- City Level (Level 5)
WITH toronto_cma AS (SELECT id FROM app.d_scope_org WHERE name = 'Toronto CMA')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, postal_code, time_zone, service_area, regulatory_jurisdiction, municipal_code, latitude, longitude, tags, attr)
SELECT 
  'Mississauga',
  'City of Mississauga - corporate headquarters org and primary operational hub with diverse residential and commercial client base',
  'MISS',
  5,
  'City',
  toronto_cma.id,
  false,
  'CA',
  'ON',
  'L5E',
  'America/Toronto',
  true,
  'municipal',
  '3521005',
  43.5890,
  -79.6441,
  '["city", "mississauga", "headquarters", "operational-hub"]'::jsonb,
  '{"population": 721599, "area_km2": 292.4, "incorporation": 1974, "headquarters": true, "business_friendly": true, "diverse_economy": true, "major_employers": ["banking", "technology", "logistics"], "strategic_org": true}'::jsonb
FROM toronto_cma

UNION ALL

SELECT 
  'Toronto',
  'City of Toronto - largest market with premium clients, high competition, and diverse service opportunities across residential and commercial sectors',
  'TOR',
  5,
  'City',
  toronto_cma.id,
  false,
  'CA',
  'ON',
  'M5H',
  'America/Toronto',
  true,
  'municipal',
  '3520005',
  43.6532,
  -79.3832,
  '["city", "toronto", "largest-market", "premium"]'::jsonb,
  '{"population": 2794356, "area_km2": 630.2, "major_market": true, "premium_segments": true, "competition": "intense", "growth_potential": "high", "market_sophistication": "high"}'::jsonb
FROM toronto_cma

UNION ALL

SELECT 
  'Oakville',
  'Town of Oakville - affluent residential market with high-end landscaping and home services demand, strategic growth target',
  'OAK',
  5,
  'City',
  toronto_cma.id,
  false,
  'CA',
  'ON',
  'L6H',
  'America/Toronto',
  true,
  'municipal',
  '3524001',
  43.4675,
  -79.6877,
  '["city", "oakville", "affluent", "residential"]'::jsonb,
  '{"population": 213759, "area_km2": 139.4, "affluent_market": true, "high_end_services": true, "growth_target": true, "residential_focus": true, "premium_pricing": true}'::jsonb
FROM toronto_cma;

-- District Level (Level 6) - Mississauga Districts
WITH mississauga AS (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, postal_code, time_zone, service_area, regulatory_jurisdiction, latitude, longitude, tags, attr)
SELECT 
  'City Centre',
  'Mississauga City Centre district - corporate headquarters area with mixed residential/commercial density and transit connectivity',
  'MISS-CC',
  6,
  'District',
  mississauga.id,
  false,
  'CA',
  'ON',
  'L5B',
  'America/Toronto',
  true,
  'district',
  43.5942,
  -79.6434,
  '["district", "city-centre", "headquarters", "mixed-use"]'::jsonb,
  '{"headquarters_district": true, "mixed_use": true, "transit_hub": true, "commercial_density": "high", "residential_condos": true, "office_buildings": true}'::jsonb
FROM mississauga

UNION ALL

SELECT 
  'Meadowvale',
  'Meadowvale district - established residential area with mature landscaping maintenance contracts and renovation opportunities',
  'MISS-MV',
  6,
  'District',
  mississauga.id,
  false,
  'CA',
  'ON',
  'L5N',
  'America/Toronto',
  true,
  'district',
  43.5833,
  -79.7333,
  '["district", "meadowvale", "residential", "established"]'::jsonb,
  '{"established_area": true, "mature_landscaping": true, "maintenance_contracts": true, "renovation_market": true, "family_oriented": true}'::jsonb
FROM mississauga;

-- Address Level (Level 7) - Specific Service Addresses (Leaf Level)
WITH city_centre AS (SELECT id FROM app.d_scope_org WHERE name = 'City Centre')
INSERT INTO app.d_scope_org (name, "descr", org_code, level_id, level_name, parent_id, is_leaf_level, country_code, province_code, postal_code, time_zone, service_area, regulatory_jurisdiction, latitude, longitude, tags, attr)
SELECT 
  '1250 South Service Rd, Mississauga, ON L5E 1V4',
  'Huron Home Services corporate headquarters and primary operational facility',
  'HHS-HQ',
  7,
  'Address',
  city_centre.id,
  true,
  'CA',
  'ON',
  'L5E 1V4',
  'America/Toronto',
  true,
  'municipal',
  43.5890,
  -79.6441,
  '["address", "headquarters", "operational-facility"]'::jsonb,
  '{"headquarters": true, "operational_facility": true, "equipment_storage": true, "dispatch_center": true, "administrative_offices": true, "training_facility": true}'::jsonb
FROM city_centre

UNION ALL

SELECT 
  '100 City Centre Dr, Mississauga, ON L5B 2C9',
  'Square One Shopping Centre area - high-density residential and commercial service zone',
  'SQ1-AREA',
  7,
  'Address',
  city_centre.id,
  true,
  'CA',
  'ON',
  'L5B 2C9',
  'America/Toronto',
  true,
  'municipal',
  43.5931,
  -79.6424,
  '["address", "square-one", "commercial", "high-density"]'::jsonb,
  '{"commercial_hub": true, "high_density": true, "transit_accessible": true, "mixed_clientele": true, "premium_org": true}'::jsonb
FROM city_centre;

-- Indexes removed for simplified import