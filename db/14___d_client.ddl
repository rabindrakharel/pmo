-- ============================================================================
-- CLIENT DIMENSION - SIMPLIFIED VERSION
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
  client_number text NOT NULL,
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
  biz_id uuid REFERENCES app.d_biz(id) ON DELETE SET NULL,
  org_id uuid,
  
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

-- Sample client data for testing
INSERT INTO app.d_client (
  name, client_number, client_type, client_status, primary_contact_name, primary_email, 
  primary_phone, primary_address, city, province, postal_code, acquisition_date,
  acquisition_channel, payment_terms, service_categories, customer_tier, lifetime_value,
  annual_contract_value, preferred_service_times, tags, attr
) VALUES
('Thompson Family Residence', 'CL-RES-001', 'residential', 'active', 'Robert Thompson', 'robert.thompson@email.com', '416-555-0101', '1847 Sheridan Park Dr', 'Oakville', 'ON', 'L6H 7S3', '2021-03-15', 'referral', 'net-15', '["landscaping", "garden_design", "seasonal_maintenance"]', 'premium', 85000.00, 25000.00, '{"preferred_days": ["tuesday", "wednesday", "thursday"], "time_range": "9am-3pm"}', '["residential", "premium", "oakville", "referral"]', '{"property_size_sqft": 8500, "pool": true, "garden_specialty": "perennial_borders", "seasonal_decorations": true, "referral_source": "neighbor"}'),
('Square One Shopping Centre', 'CL-COM-001', 'commercial', 'active', 'Jennifer Walsh', 'jennifer.walsh@squareone.com', '905-555-0201', '100 City Centre Dr', 'Mississauga', 'ON', 'L5B 2C9', '2020-01-15', 'rfp_process', 'net-45', '["landscaping", "snow_removal", "seasonal_decorations"]', 'enterprise', 500000.00, 120000.00, '{"service_windows": "off_hours", "coordination_required": true, "seasonal_intensive": true}', '["commercial", "enterprise", "retail", "high-visibility"]', '{"property_size_acres": 85, "foot_traffic": "high", "seasonal_decorations": true, "public_space": true, "media_visibility": true}'),
('City of Mississauga', 'CL-MUN-001', 'municipal', 'active', 'Paul Martineau', 'paul.martineau@mississauga.ca', '905-615-3200', '300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1', '2021-09-15', 'public_tender', 'net-45', '["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"]', 'government', 750000.00, 250000.00, '{"public_hours_coordination": true, "environmental_compliance": "strict", "public_safety": "priority"}', '["municipal", "government", "public-spaces", "environmental"]', '{"parks": 45, "public_spaces_acres": 2500, "environmental_standards": "highest", "public_visibility": "maximum", "citizen_satisfaction": "critical"}'),

-- Additional Residential Clients
('Martinez Family Home', 'CL-RES-002', 'residential', 'active', 'Isabella Martinez', 'isabella.martinez@gmail.com', '647-555-0102', '2156 Lakeshore Rd W', 'Oakville', 'ON', 'L6L 1H2', '2021-05-20', 'online_search', 'net-15', '["landscaping", "seasonal_cleanup", "snow_removal"]', 'standard', 42000.00, 12000.00, '{"preferred_days": ["friday", "saturday"], "time_range": "8am-5pm"}', '["residential", "standard", "oakville", "online"]', '{"property_size_sqft": 6200, "driveway": "double", "garden_type": "low_maintenance", "snow_priority": "high"}'),
('The Chen Estate', 'CL-RES-003', 'residential', 'active', 'David Chen', 'david.chen@outlook.com', '905-555-0103', '3425 Mississauga Rd', 'Mississauga', 'ON', 'L5L 3R8', '2020-08-10', 'referral', 'net-30', '["landscaping", "garden_design", "seasonal_maintenance", "pool_maintenance"]', 'premium', 120000.00, 35000.00, '{"preferred_days": ["monday", "tuesday"], "time_range": "10am-2pm", "seasonal_intensive": true}', '["residential", "premium", "mississauga", "estate"]', '{"property_size_sqft": 12500, "pool": true, "tennis_court": true, "garden_specialty": "japanese_design", "irrigation_system": true}'),
('Wilson Townhouse', 'CL-RES-004', 'residential', 'active', 'Sarah Wilson', 'swilson@rogers.com', '416-555-0104', '45 Elm Drive', 'Toronto', 'ON', 'M4W 1N4', '2022-01-15', 'social_media', 'net-15', '["landscaping", "seasonal_cleanup"]', 'standard', 18000.00, 6000.00, '{"preferred_days": ["saturday"], "time_range": "9am-1pm"}', '["residential", "standard", "toronto", "townhouse"]', '{"property_size_sqft": 1800, "front_yard_only": true, "small_space_design": true, "low_maintenance": true}'),

-- Additional Commercial Clients  
('Sheridan College', 'CL-COM-002', 'commercial', 'active', 'Mark Patterson', 'mark.patterson@sheridancollege.ca', '905-845-9430', '7899 McLaughlin Rd', 'Brampton', 'ON', 'L6Y 5H9', '2020-12-01', 'rfp_process', 'net-60', '["landscaping", "snow_removal", "grounds_maintenance"]', 'enterprise', 450000.00, 150000.00, '{"academic_calendar_sensitive": true, "student_safety": "priority", "environmental_education": true}', '["commercial", "education", "enterprise", "public"]', '{"campus_acres": 125, "buildings": 12, "parking_lots": 8, "environmental_certification": "LEED", "student_population": 23000}'),
('Erin Mills Town Centre', 'CL-COM-003', 'commercial', 'active', 'Lisa Kim', 'lkim@erinmillstc.com', '905-828-7000', '5100 Erin Mills Pkwy', 'Mississauga', 'ON', 'L5M 4Z5', '2021-07-20', 'competitive_bid', 'net-45', '["landscaping", "snow_removal", "seasonal_decorations", "parking_lot_maintenance"]', 'enterprise', 380000.00, 95000.00, '{"retail_hours_coordination": true, "customer_experience": "priority", "seasonal_events": true}', '["commercial", "retail", "enterprise", "seasonal"]', '{"property_acres": 45, "parking_spaces": 4200, "foot_traffic": "very_high", "seasonal_events": 12, "anchor_stores": 3}'),
('Ontario Power Generation', 'CL-COM-004', 'commercial', 'active', 'Jennifer Clarke', 'jennifer.clarke@opg.com', '905-839-6000', '700 University Ave', 'Toronto', 'ON', 'M5G 1X6', '2021-03-01', 'procurement', 'net-45', '["landscaping", "grounds_maintenance", "environmental_compliance"]', 'enterprise', 650000.00, 180000.00, '{"security_clearance_required": true, "environmental_strict": true, "safety_protocols": "nuclear"}', '["commercial", "utilities", "government", "high-security"]', '{"facilities": 15, "environmental_compliance": "nuclear", "security_level": "high", "specialized_equipment": true}'),
('Heartland Business Park', 'CL-COM-005', 'commercial', 'active', 'Robert Singh', 'rsingh@heartlandpark.ca', '905-568-7000', '5985 Mavis Rd', 'Mississauga', 'ON', 'L5R 3T7', '2020-06-15', 'property_management', 'net-30', '["landscaping", "snow_removal", "general_maintenance"]', 'standard', 280000.00, 85000.00, '{"business_hours_coordination": true, "multi_tenant": true, "cost_efficiency": "priority"}', '["commercial", "business-park", "multi-tenant", "standard"]', '{"buildings": 25, "tenants": 150, "parking_acres": 35, "common_areas_sqft": 85000, "office_park": true}'),

-- Healthcare and Senior Living
('Trillium Health Partners', 'CL-COM-006', 'commercial', 'active', 'Dr. Patricia Moore', 'patricia.moore@thp.ca', '905-848-7100', '100 Queensway W', 'Mississauga', 'ON', 'L5B 1B8', '2021-11-01', 'healthcare_procurement', 'net-60', '["landscaping", "grounds_maintenance", "healing_gardens", "accessibility"]', 'premium', 520000.00, 160000.00, '{"patient_care": "priority", "accessibility": "full", "healing_environment": true, "infection_control": true}', '["healthcare", "hospital", "healing-gardens", "accessibility"]', '{"campus_acres": 45, "buildings": 8, "healing_gardens": 6, "patient_capacity": 850, "staff": 3200}'),
('Amica Senior Living', 'CL-COM-007', 'commercial', 'active', 'Carol Henderson', 'carol.henderson@amica.ca', '905-607-5050', '3180 Kirwin Ave', 'Mississauga', 'ON', 'L5A 3R2', '2022-02-15', 'competitive_bid', 'net-45', '["landscaping", "seasonal_maintenance", "accessible_gardens", "safety_focus"]', 'premium', 340000.00, 95000.00, '{"senior_safety": "priority", "accessible_design": true, "seasonal_activities": true}', '["senior-living", "accessibility", "premium", "safety"]', '{"residents": 220, "staff": 85, "garden_areas": 4, "accessibility_features": "full", "memory_care": true}'),

-- Industrial and Manufacturing
('Magna International', 'CL-COM-008', 'commercial', 'active', 'Thomas Weber', 'thomas.weber@magna.com', '905-726-2462', '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1', '2020-09-15', 'corporate_procurement', 'net-60', '["landscaping", "industrial_grounds", "snow_removal", "parking_maintenance"]', 'enterprise', 890000.00, 280000.00, '{"industrial_safety": "critical", "employee_parking": "priority", "environmental_compliance": "strict"}', '["industrial", "manufacturing", "enterprise", "automotive"]', '{"facilities": 35, "employees": 15000, "parking_spaces": 8500, "manufacturing_sites": true, "environmental_certification": "ISO14001"}');