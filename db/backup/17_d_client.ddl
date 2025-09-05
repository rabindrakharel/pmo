-- ============================================================================
-- CLIENT DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Client master dimension representing all customers across residential and
--   commercial market segments. Provides foundation for customer relationship
--   management, service delivery tracking, revenue analysis, and market
--   segmentation across all business lines.
--
-- Client Categories:
--   - Residential: Individual homeowners and residential property owners
--   - Commercial: Business entities and commercial property managers
--   - Municipal: Government entities and municipal corporations
--   - Institutional: Educational, healthcare, and institutional clients
--   - Property Management: Property management companies and REITs
--
-- Integration:
--   - Links to d_scope_location for geographic client distribution
--   - Supports project assignment and service delivery tracking
--   - Enables revenue analysis and customer lifetime value calculation
--   - Facilitates market segmentation and business development

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_client (
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

  -- Client identification
  client_number text UNIQUE NOT NULL,
  client_type text NOT NULL DEFAULT 'residential',
  client_status text NOT NULL DEFAULT 'active',
  
  -- Contact information
  primary_contact_name text,
  primary_contact_title text,
  primary_email text,
  primary_phone text,
  secondary_phone text,
  
  -- Address and location
  primary_address text,
  city text,
  province text DEFAULT 'ON',
  postal_code text,
  location_id uuid,
  
  -- Business information
  business_name text,
  business_type text,
  industry_sector text,
  gst_hst_number text,
  
  -- Client attributes
  acquisition_date date,
  acquisition_channel text,
  credit_rating text DEFAULT 'good',
  payment_terms text DEFAULT 'net-30',
  preferred_communication text DEFAULT 'email',
  
  -- Service preferences
  service_categories jsonb DEFAULT '[]'::jsonb,
  seasonal_client boolean DEFAULT false,
  emergency_services boolean DEFAULT false,
  preferred_service_times jsonb DEFAULT '{}'::jsonb,
  
  -- Relationship and value
  account_manager_id uuid,
  customer_tier text DEFAULT 'standard',
  lifetime_value numeric(12,2),
  annual_contract_value numeric(12,2),
  
  -- Special requirements
  special_instructions text,
  access_requirements jsonb DEFAULT '{}'::jsonb,
  insurance_requirements jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Client Portfolio

-- Residential Clients - High-Value Homeowners
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_email, 
  primary_phone, primary_address, city, province, postal_code, acquisition_date,
  acquisition_channel, payment_terms, service_categories, customer_tier, lifetime_value,
  annual_contract_value, preferred_service_times, tags, attr
) VALUES
('Thompson Family Residence', 'CL-RES-001', 'residential', 'active', 'Robert Thompson', 'robert.thompson@email.com', 
'416-555-0101', '1847 Sheridan Park Dr', 'Oakville', 'ON', 'L6H 7S3', '2021-03-15',
'referral', 'net-15', '["landscaping", "garden_design", "seasonal_maintenance"]', 'premium', 85000.00,
25000.00, '{"preferred_days": ["tuesday", "wednesday", "thursday"], "time_range": "9am-3pm"}',
'["residential", "premium", "oakville", "referral"]',
'{"property_size_sqft": 8500, "pool": true, "garden_specialty": "perennial_borders", "seasonal_decorations": true, "referral_source": "neighbor"}'),

('Miller Property Portfolio', 'CL-RES-002', 'residential', 'active', 'Sarah Miller', 'sarah.miller@email.com',
'905-555-0102', '2450 Lakeshore Blvd W', 'Mississauga', 'ON', 'L5J 1K5', '2020-05-20',
'website', 'net-30', '["landscaping", "snow_removal", "hvac_maintenance"]', 'premium', 125000.00,
35000.00, '{"preferred_days": ["monday", "wednesday", "friday"], "time_range": "8am-5pm"}',
'["residential", "premium", "mississauga", "multi-service"]',
'{"property_count": 2, "investment_properties": true, "full_service": true, "long_term_contracts": true}'),

('Chen Family Estate', 'CL-RES-003', 'residential', 'active', 'David Chen', 'david.chen@email.com',
'647-555-0103', '156 Forest Hill Rd', 'Toronto', 'ON', 'M5P 2L9', '2021-07-10',
'landscape_architect_referral', 'net-15', '["garden_design", "water_features", "landscape_lighting"]', 'luxury', 150000.00,
40000.00, '{"preferred_days": ["tuesday", "thursday"], "time_range": "10am-2pm", "quiet_hours": true}',
'["residential", "luxury", "toronto", "design-focused"]',
'{"property_size_sqft": 12000, "heritage_property": true, "water_features": 3, "garden_rooms": 5, "lighting_system": "smart"}');

-- Commercial Clients - Office Buildings and Retail
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_contact_title,
  primary_email, primary_phone, business_name, business_type, industry_sector,
  primary_address, city, province, postal_code, gst_hst_number, acquisition_date,
  acquisition_channel, credit_rating, payment_terms, service_categories, customer_tier,
  lifetime_value, annual_contract_value, preferred_service_times, tags, attr
) VALUES
('Square One Shopping Centre', 'CL-COM-001', 'commercial', 'active', 'Jennifer Walsh', 'Property Manager',
'jennifer.walsh@squareone.com', '905-555-0201', 'Oxford Properties Group', 'real_estate', 'retail',
'100 City Centre Dr', 'Mississauga', 'ON', 'L5B 2C9', '123456789RT0001', '2020-01-15',
'rfp_process', 'excellent', 'net-45', '["landscaping", "snow_removal", "seasonal_decorations"]', 'enterprise', 500000.00,
120000.00, '{"service_windows": "off_hours", "coordination_required": true, "seasonal_intensive": true}',
'["commercial", "enterprise", "retail", "high-visibility"]',
'{"property_size_acres": 85, "foot_traffic": "high", "seasonal_decorations": true, "public_space": true, "media_visibility": true}'),

('Meadowvale Business Park', 'CL-COM-002', 'commercial', 'active', 'Michael Patterson', 'Facilities Director',
'michael.patterson@meadowvalebp.com', '905-555-0202', 'CBRE Limited', 'property_management', 'office',
'6750 Mississauga Rd', 'Mississauga', 'ON', 'L5N 2L3', '234567890RT0001', '2020-08-01',
'direct_sales', 'good', 'net-30', '["landscaping", "snow_removal", "hvac_maintenance"]', 'corporate', 285000.00,
95000.00, '{"business_hours_only": true, "minimal_disruption": true, "professional_appearance": "critical"}',
'["commercial", "corporate", "office-park", "professional"]',
'{"buildings": 8, "parking_spaces": 1200, "landscape_area_sqft": 150000, "professional_standards": "high", "tenant_satisfaction": "critical"}'),

('Toronto Premium Office Tower', 'CL-COM-003', 'commercial', 'active', 'Lisa Chang', 'Building Operations Manager',
'lisa.chang@torontotower.com', '416-555-0203', 'Brookfield Properties', 'real_estate', 'office',
'200 Bay St', 'Toronto', 'ON', 'M5J 2J3', '345678901RT0001', '2021-04-12',
'competitive_bid', 'excellent', 'net-60', '["hvac_maintenance", "emergency_services", "facility_management"]', 'enterprise', 450000.00,
180000.00, '{"24_7_access": true, "emergency_response": "4_hours", "tenant_coordination": "required"}',
'["commercial", "enterprise", "office-tower", "downtown"]',
'{"floors": 45, "square_feet": 1800000, "tenants": 75, "hvac_zones": 120, "emergency_systems": "redundant", "sustainability_rating": "leed_gold"});

-- Municipal and Institutional Clients
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_contact_title,
  primary_email, primary_phone, business_name, business_type, industry_sector,
  primary_address, city, province, postal_code, acquisition_date, acquisition_channel,
  credit_rating, payment_terms, service_categories, customer_tier, lifetime_value,
  annual_contract_value, preferred_service_times, tags, attr
) VALUES
('City of Mississauga', 'CL-MUN-001', 'municipal', 'active', 'Paul Martineau', 'Parks and Recreation Director',
'paul.martineau@mississauga.ca', '905-615-3200', 'City of Mississauga', 'municipal', 'government',
'300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1', '2021-09-15', 'public_tender',
'excellent', 'net-45', '["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"]', 'government', 750000.00,
250000.00, '{"public_hours_coordination": true, "environmental_compliance": "strict", "public_safety": "priority"}',
'["municipal", "government", "public-spaces", "environmental"]',
'{"parks": 45, "public_spaces_acres": 2500, "environmental_standards": "highest", "public_visibility": "maximum", "citizen_satisfaction": "critical"}'),

('University of Toronto Mississauga', 'CL-INST-001', 'institutional', 'active', 'Amanda Foster', 'Campus Operations Manager',
'amanda.foster@utm.utoronto.ca', '905-828-3789', 'University of Toronto', 'educational', 'education',
'3359 Mississauga Rd', 'Mississauga', 'ON', 'L5L 1C6', '2022-01-20', 'institutional_rfp',
'excellent', 'net-60', '["landscaping", "grounds_maintenance", "seasonal_services", "sustainability"]', 'institutional', 425000.00,
150000.00, '{"academic_calendar": true, "sustainability_focus": true, "student_safety": "priority"}',
'["institutional", "education", "sustainability", "campus"]',
'{"campus_acres": 225, "buildings": 35, "student_population": 14000, "sustainability_mandate": true, "research_gardens": 3, "public_access": true});

-- Property Management Companies
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_contact_title,
  primary_email, primary_phone, business_name, business_type, industry_sector,
  primary_address, city, province, postal_code, gst_hst_number, acquisition_date,
  acquisition_channel, credit_rating, payment_terms, service_categories, customer_tier,
  lifetime_value, annual_contract_value, preferred_service_times, tags, attr
) VALUES
('Residential Property Management Inc.', 'CL-PM-001', 'property_management', 'active', 'Tom Richardson', 'Operations Director',
'tom.richardson@rpmcanada.com', '905-555-0301', 'RPM Canada', 'property_management', 'residential',
'1500 Dundas St E', 'Mississauga', 'ON', 'L4X 1L4', '456789012RT0001', '2021-11-30',
'partnership', 'good', 'net-30', '["landscaping", "snow_removal", "maintenance", "emergency_services"]', 'corporate', 380000.00,
125000.00, '{"multi_property": true, "tenant_satisfaction": "important", "cost_efficiency": "priority"}',
'["property-management", "corporate", "multi-property", "residential"]',
'{"properties_managed": 45, "units_total": 1200, "service_locations": "gta_wide", "tenant_focus": true, "maintenance_contracts": "comprehensive"}'),

('Commercial Asset Management', 'CL-PM-002', 'property_management', 'active', 'Kevin O\'Brien', 'Facility Services Manager',
'kevin.obrien@camassets.com', '416-555-0302', 'CAM Assets Ltd.', 'property_management', 'commercial',
'5000 Yonge St', 'Toronto', 'ON', 'M2N 7E9', '567890123RT0001', '2022-03-15',
'industry_referral', 'excellent', 'net-45', '["facility_management", "hvac_services", "emergency_response", "preventive_maintenance"]', 'enterprise', 650000.00,
220000.00, '{"portfolio_wide": true, "tenant_coordination": "complex", "service_standards": "premium"}',
'["property-management", "enterprise", "commercial", "facility-services"]',
'{"commercial_properties": 25, "office_space_sqft": 3500000, "retail_space_sqft": 500000, "service_complexity": "high", "tenant_diversity": "wide"});

-- High-Value Residential Clients
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_email,
  primary_phone, primary_address, city, province, postal_code, acquisition_date,
  acquisition_channel, payment_terms, service_categories, seasonal_client, customer_tier,
  lifetime_value, annual_contract_value, preferred_service_times, tags, attr
) VALUES
('Rosedale Executive Estate', 'CL-RES-004', 'residential', 'active', 'Sandra Mitchell', 'sandra.mitchell@email.com',
'416-555-0104', '45 Elm Ave', 'Toronto', 'ON', 'M4W 1M6', '2022-04-01',
'luxury_referral', 'net-15', '["garden_design", "estate_maintenance", "seasonal_services", "special_events"]', true, 'luxury', 200000.00,
60000.00, '{"discretion_required": true, "flexible_scheduling": true, "special_events": "frequent"}',
'["residential", "luxury", "toronto", "estate"]',
'{"estate_acres": 3.5, "heritage_designation": true, "entertainment_areas": 4, "special_events": 12, "privacy_requirements": "high", "media_attention": "occasional"}'),

('Mississauga Executive Community', 'CL-RES-005', 'residential', 'active', 'Carlos Santos', 'carlos.santos@email.com',
'905-555-0105', '2100 Credit Valley Rd', 'Mississauga', 'ON', 'L5M 4N4', '2022-06-15',
'developer_partnership', 'net-30', '["community_landscaping", "common_areas", "seasonal_maintenance"]', true, 'corporate', 320000.00,
80000.00, '{"community_standards": "high", "homeowner_satisfaction": "critical", "seasonal_intensive": true}',
'["residential", "corporate", "community", "developer-partnership"]',
'{"homes": 185, "common_areas_acres": 25, "amenities": ["clubhouse", "pool", "tennis"], "hoa_managed": true, "standards_compliance": "strict"});

-- Indexes removed for simplified import