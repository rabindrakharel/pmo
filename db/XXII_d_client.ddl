-- ============================================================================
-- XXII. CLIENT ENTITIES
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Client entities representing customers, stakeholders, and service recipients
--   across residential, commercial, municipal, and industrial sectors. Provides
--   foundation for relationship management, service delivery, contract management,
--   and revenue tracking across all client engagement types.
--
-- Entity Type: client
-- Entity Classification: Standalone Entity (can be parent or action entity)
--
-- Parent Entities:
--   - biz (business units manage client relationships)
--   - org (geographic client assignment and service delivery)
--
-- Action Entities:
--   - project (projects delivered for clients)
--   - task (tasks performed for specific clients)
--   - form (client service forms and assessments)
--   - artifact (client documentation, contracts, reports)
--   - wiki (client-specific knowledge and procedures)
--
-- Client Categories:
--   - residential: Individual homeowners and residential properties
--   - commercial: Business clients including retail, office, healthcare
--   - municipal: Government entities and public sector organizations
--   - industrial: Manufacturing and large-scale industrial facilities
--
-- Client Hierarchy Levels:
--   - Level 0: CEO (Chief Executive Officer with final decision authority)
--   - Level 1: Director (Director level with departmental authority)
--   - Level 2: Senior Manager (Senior Manager with program oversight)
--   - Level 3: Manager (Manager with team leadership)
--   - Level 4: Technical Lead (Technical Lead with subject matter expertise)
--
-- New Design Integration:
--   - Maps to entity_id_hierarchy_mapping for parent-child relationships
--   - No direct foreign keys to other entities (follows new standard)
--   - Supports RBAC via entity_id_rbac_map table
--   - Uses common field structure across all entities
--   - Includes metadata jsonb field for extensibility
--   - Supports client hierarchy via meta_client_level references
--
-- Legacy Design Elements Retained:
--   - Client identification and categorization
--   - Contact information and communication preferences
--   - Business information and financial attributes
--   - Service preferences and special requirements
--   - Relationship management and value tracking
--
-- UI Navigation Model:
--   - Appears in sidebar menu as "Client"
--   - Main page shows FilteredDataTable with searchable/filterable clients
--   - Row click navigates to Client Detail Page
--   - Detail page shows Overview tab + child entity tabs (projects, tasks, etc.)
--   - Inline editing available on detail page with RBAC permission checks

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (common across all entities) - ALWAYS FIRST
  slug varchar(255),
  code varchar(100),
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version int DEFAULT 1,

  -- Entity metadata (new standard)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Client identification
  client_number text NOT NULL,
  client_type text NOT NULL DEFAULT 'residential',
  client_status text NOT NULL DEFAULT 'active',

  -- Contact information
  primary_contact_name text,
  primary_contact_title text,
  primary_email text,
  primary_phone text,
  secondary_phone text,

  -- Address and location (no direct FK - use entity_id_hierarchy_mapping)
  primary_address text,
  city text,
  province text DEFAULT 'ON',
  postal_code text,

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

  -- Relationship and value (no direct FK - use entity_id_hierarchy_mapping)
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
-- Comprehensive client data across all service categories and client types

-- Premium Residential Clients
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('thompson-family-residence', 'CL-RES-001', 'Thompson Family Residence', 'CL-RES-001', 'residential', 'active',
 'Robert Thompson', 'robert.thompson@email.com', '416-555-0101',
 '1847 Sheridan Park Dr', 'Oakville', 'ON', 'L6H 7S3',
 '2021-03-15', 'referral', 'net-15',
 '["landscaping", "garden_design", "seasonal_maintenance"]',
 'premium', 85000.00, 25000.00,
 '{"preferred_days": ["tuesday", "wednesday", "thursday"], "time_range": "9am-3pm"}',
 '["residential", "premium", "oakville", "referral"]',
 '{"property_size_sqft": 8500, "pool": true, "garden_specialty": "perennial_borders", "seasonal_decorations": true, "referral_source": "neighbor"}'),

('chen-estate', 'CL-RES-003', 'The Chen Estate', 'CL-RES-003', 'residential', 'active',
 'David Chen', 'david.chen@outlook.com', '905-555-0103',
 '3425 Mississauga Rd', 'Mississauga', 'ON', 'L5L 3R8',
 '2020-08-10', 'referral', 'net-30',
 '["landscaping", "garden_design", "seasonal_maintenance", "pool_maintenance"]',
 'premium', 120000.00, 35000.00,
 '{"preferred_days": ["monday", "tuesday"], "time_range": "10am-2pm", "seasonal_intensive": true}',
 '["residential", "premium", "mississauga", "estate"]',
 '{"property_size_sqft": 12500, "pool": true, "tennis_court": true, "garden_specialty": "japanese_design", "irrigation_system": true}');

-- Standard Residential Clients
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('martinez-family-home', 'CL-RES-002', 'Martinez Family Home', 'CL-RES-002', 'residential', 'active',
 'Isabella Martinez', 'isabella.martinez@gmail.com', '647-555-0102',
 '2156 Lakeshore Rd W', 'Oakville', 'ON', 'L6L 1H2',
 '2021-05-20', 'online_search', 'net-15',
 '["landscaping", "seasonal_cleanup", "snow_removal"]',
 'standard', 42000.00, 12000.00,
 '{"preferred_days": ["friday", "saturday"], "time_range": "8am-5pm"}',
 '["residential", "standard", "oakville", "online"]',
 '{"property_size_sqft": 6200, "driveway": "double", "garden_type": "low_maintenance", "snow_priority": "high"}'),

('wilson-townhouse', 'CL-RES-004', 'Wilson Townhouse', 'CL-RES-004', 'residential', 'active',
 'Sarah Wilson', 'swilson@rogers.com', '416-555-0104',
 '45 Elm Drive', 'Toronto', 'ON', 'M4W 1N4',
 '2022-01-15', 'social_media', 'net-15',
 '["landscaping", "seasonal_cleanup"]',
 'standard', 18000.00, 6000.00,
 '{"preferred_days": ["saturday"], "time_range": "9am-1pm"}',
 '["residential", "standard", "toronto", "townhouse"]',
 '{"property_size_sqft": 1800, "front_yard_only": true, "small_space_design": true, "low_maintenance": true}');

-- Enterprise Commercial Clients
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('square-one-shopping', 'CL-COM-001', 'Square One Shopping Centre', 'CL-COM-001', 'commercial', 'active',
 'Jennifer Walsh', 'jennifer.walsh@squareone.com', '905-555-0201',
 '100 City Centre Dr', 'Mississauga', 'ON', 'L5B 2C9',
 '2020-01-15', 'rfp_process', 'net-45',
 '["landscaping", "snow_removal", "seasonal_decorations"]',
 'enterprise', 500000.00, 120000.00,
 '{"service_windows": "off_hours", "coordination_required": true, "seasonal_intensive": true}',
 '["commercial", "enterprise", "retail", "high-visibility"]',
 '{"property_size_acres": 85, "foot_traffic": "high", "seasonal_decorations": true, "public_space": true, "media_visibility": true}'),

('sheridan-college', 'CL-COM-002', 'Sheridan College', 'CL-COM-002', 'commercial', 'active',
 'Mark Patterson', 'mark.patterson@sheridancollege.ca', '905-845-9430',
 '7899 McLaughlin Rd', 'Brampton', 'ON', 'L6Y 5H9',
 '2020-12-01', 'rfp_process', 'net-60',
 '["landscaping", "snow_removal", "grounds_maintenance"]',
 'enterprise', 450000.00, 150000.00,
 '{"academic_calendar_sensitive": true, "student_safety": "priority", "environmental_education": true}',
 '["commercial", "education", "enterprise", "public"]',
 '{"campus_acres": 125, "buildings": 12, "parking_lots": 8, "environmental_certification": "LEED", "student_population": 23000}'),

('ontario-power-generation', 'CL-COM-004', 'Ontario Power Generation', 'CL-COM-004', 'commercial', 'active',
 'Jennifer Clarke', 'jennifer.clarke@opg.com', '905-839-6000',
 '700 University Ave', 'Toronto', 'ON', 'M5G 1X6',
 '2021-03-01', 'procurement', 'net-45',
 '["landscaping", "grounds_maintenance", "environmental_compliance"]',
 'enterprise', 650000.00, 180000.00,
 '{"security_clearance_required": true, "environmental_strict": true, "safety_protocols": "nuclear"}',
 '["commercial", "utilities", "government", "high-security"]',
 '{"facilities": 15, "environmental_compliance": "nuclear", "security_level": "high", "specialized_equipment": true}');

-- Municipal Government Clients
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('city-of-mississauga', 'CL-MUN-001', 'City of Mississauga', 'CL-MUN-001', 'municipal', 'active',
 'Paul Martineau', 'paul.martineau@mississauga.ca', '905-615-3200',
 '300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1',
 '2021-09-15', 'public_tender', 'net-45',
 '["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"]',
 'government', 750000.00, 250000.00,
 '{"public_hours_coordination": true, "environmental_compliance": "strict", "public_safety": "priority"}',
 '["municipal", "government", "public-spaces", "environmental"]',
 '{"parks": 45, "public_spaces_acres": 2500, "environmental_standards": "highest", "public_visibility": "maximum", "citizen_satisfaction": "critical"}');

-- Healthcare and Senior Living
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('trillium-health', 'CL-COM-006', 'Trillium Health Partners', 'CL-COM-006', 'commercial', 'active',
 'Dr. Patricia Moore', 'patricia.moore@thp.ca', '905-848-7100',
 '100 Queensway W', 'Mississauga', 'ON', 'L5B 1B8',
 '2021-11-01', 'healthcare_procurement', 'net-60',
 '["landscaping", "grounds_maintenance", "healing_gardens", "accessibility"]',
 'premium', 520000.00, 160000.00,
 '{"patient_care": "priority", "accessibility": "full", "healing_environment": true, "infection_control": true}',
 '["healthcare", "hospital", "healing-gardens", "accessibility"]',
 '{"campus_acres": 45, "buildings": 8, "healing_gardens": 6, "patient_capacity": 850, "staff": 3200}'),

('amica-senior-living', 'CL-COM-007', 'Amica Senior Living', 'CL-COM-007', 'commercial', 'active',
 'Carol Henderson', 'carol.henderson@amica.ca', '905-607-5050',
 '3180 Kirwin Ave', 'Mississauga', 'ON', 'L5A 3R2',
 '2022-02-15', 'competitive_bid', 'net-45',
 '["landscaping", "seasonal_maintenance", "accessible_gardens", "safety_focus"]',
 'premium', 340000.00, 95000.00,
 '{"senior_safety": "priority", "accessible_design": true, "seasonal_activities": true}',
 '["senior-living", "accessibility", "premium", "safety"]',
 '{"residents": 220, "staff": 85, "garden_areas": 4, "accessibility_features": "full", "memory_care": true}');

-- Industrial Manufacturing
INSERT INTO app.d_client (
  slug, code, name, client_number, client_type, client_status, primary_contact_name,
  primary_email, primary_phone, primary_address, city, province, postal_code,
  acquisition_date, acquisition_channel, payment_terms, service_categories,
  customer_tier, lifetime_value, annual_contract_value, preferred_service_times,
  tags, metadata
) VALUES
('magna-international', 'CL-COM-008', 'Magna International', 'CL-COM-008', 'commercial', 'active',
 'Thomas Weber', 'thomas.weber@magna.com', '905-726-2462',
 '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1',
 '2020-09-15', 'corporate_procurement', 'net-60',
 '["landscaping", "industrial_grounds", "snow_removal", "parking_maintenance"]',
 'enterprise', 890000.00, 280000.00,
 '{"industrial_safety": "critical", "employee_parking": "priority", "environmental_compliance": "strict"}',
 '["industrial", "manufacturing", "enterprise", "automotive"]',
 '{"facilities": 35, "employees": 15000, "parking_spaces": 8500, "manufacturing_sites": true, "environmental_certification": "ISO14001"}');