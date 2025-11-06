-- ============================================================================
-- CUSTOMER ENTITY (d_cust) - CRM
-- ============================================================================
--
-- SEMANTICS:
-- • Customer entities across sectors (residential, commercial, municipal, industrial)
-- • CRM foundation: relationship management, service delivery, revenue tracking
-- • Sales funnel progression, tier management, app user authentication
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/cust, INSERT with version=1, active_flag=true
-- • SIGNUP: POST /api/v1/auth/customer/signup (creates account with password_hash)
-- • SIGNIN: POST /api/v1/auth/customer/signin (JWT auth, updates last_login_ts)
-- • UPDATE: PUT /api/v1/cust/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now(), cust_status='inactive'
-- • LIST: Filter by type/tier/funnel, RBAC enforced
-- • REVENUE: Aggregates project budgets, lifetime_value analytics
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code, cust_number: varchar UNIQUE ('CL-RES-001')
-- • cust_type: varchar (residential, commercial, municipal, industrial)
-- • cust_status: varchar (active, inactive, prospect, former)
-- • dl__customer_opportunity_funnel: text (Lead→Qualified→Proposal→Closed Won)
-- • dl__customer_tier: text (Bronze, Silver, Gold, Platinum)
-- • dl__industry_sector, dl__acquisition_channel: text (from setting_datalabel)
-- • primary_contact_name, primary_email, primary_phone: varchar
-- • password_hash: varchar(255) (bcrypt, for app user login, never returned)
-- • entities: text[] (configured entities for sidebar: ['project', 'task', 'wiki'])
-- • metadata: jsonb (lifetime_value, annual_contract_value, payment_terms)
--
-- RELATIONSHIPS:
-- • Children: project, artifact, form, cost, revenue (via d_entity_id_map)
-- • RBAC: entity_id_rbac_map
--
-- ============================================================================

CREATE TABLE app.d_cust (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Customer identification
  cust_number text NOT NULL,
  cust_type text NOT NULL DEFAULT 'residential',
  cust_status text NOT NULL DEFAULT 'active',


  -- Address and location (no direct FK - use entity_id_hierarchy_mapping)
  primary_address text,
  city text,
  province text DEFAULT 'ON',
  postal_code text,
  country text DEFAULT 'Canada',
  geo_coordinates jsonb,  -- e.g. {"latitude": 43.5890, "longitude": -79.6441},

  -- Business information
  business_legal_name text,
  business_type text,
  gst_hst_number text,
  business_number text,

  -- Sales and Marketing
  dl__customer_opportunity_funnel text,  -- References app.setting_datalabel (datalabel_name='customer_opportunity_funnel')
  dl__industry_sector text,           -- References app.setting_datalabel (datalabel_name='industry__sector')
  dl__acquisition_channel text,       -- References app.setting_datalabel (datalabel_name='acquisition__channel')
  dl__customer_tier text,             -- References app.setting_datalabel (datalabel_name='customer__tier')


  -- Contact information
  primary_contact_name text,
  primary_email text,
  primary_phone text,
  secondary_contact_name text,
  secondary_email text,
  secondary_phone text,

  -- Authentication fields (for app user signup)
  password_hash text,
  last_login_ts timestamptz,
  password_reset_token text,
  password_reset_expires_ts timestamptz,
  failed_login_attempts int DEFAULT 0,
  account_locked_until_ts timestamptz,

  -- Entity configuration (activated entities for this user)
  entities text[] DEFAULT ARRAY[]::text[]
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Customer Portfolio
-- Comprehensive customer data across all service categories and customer types
-- ALIGNED WITH DDL SCHEMA - Extra fields in metadata JSONB

-- Premium Residential Customers
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-RES-001', 'Thompson Family Residence', 'CL-RES-001', 'residential', 'active',
 'Robert Thompson', 'robert.thompson@email.com', '416-555-0101',
 '1847 Sheridan Park Dr', 'Oakville', 'ON', 'L6H 7S3',
 'Closed Won', 'Residential', 'Referral', 'Gold',
 '{"acquisition_date": "2021-03-15", "payment_terms": "net-15", "service_categories": ["landscaping", "garden_design", "seasonal_maintenance"], "lifetime_value": 85000.00, "annual_contract_value": 25000.00, "preferred_service_times": {"preferred_days": ["tuesday", "wednesday", "thursday"], "time_range": "9am-3pm"}, "acquisition_cost": 450.00, "property_size_sqft": 8500, "pool": true, "garden_specialty": "perennial_borders", "seasonal_decorations": true, "referral_source": "neighbor"}'::jsonb),

('CL-RES-003', 'The Chen Estate', 'CL-RES-003', 'residential', 'active',
 'David Chen', 'david.chen@outlook.com', '905-555-0103',
 '3425 Mississauga Rd', 'Mississauga', 'ON', 'L5L 3R8',
 'Closed Won', 'Residential', 'Referral', 'Gold',
 '{"acquisition_date": "2020-08-10", "payment_terms": "net-30", "service_categories": ["landscaping", "garden_design", "seasonal_maintenance", "pool_maintenance"], "lifetime_value": 120000.00, "annual_contract_value": 35000.00, "preferred_service_times": {"preferred_days": ["monday", "tuesday"], "time_range": "10am-2pm", "seasonal_intensive": true}, "acquisition_cost": 380.00, "property_size_sqft": 12500, "pool": true, "tennis_court": true, "garden_specialty": "japanese_design", "irrigation_system": true}'::jsonb);

-- Standard Residential Customers
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-RES-002', 'Martinez Family Home', 'CL-RES-002', 'residential', 'active',
 'Isabella Martinez', 'isabella.martinez@gmail.com', '647-555-0102',
 '2156 Lakeshore Rd W', 'Oakville', 'ON', 'L6L 1H2',
 'Closed Won', 'Residential', 'Organic Search', 'Silver',
 '{"acquisition_date": "2021-05-20", "payment_terms": "net-15", "service_categories": ["landscaping", "seasonal_cleanup", "snow_removal"], "lifetime_value": 42000.00, "annual_contract_value": 12000.00, "preferred_service_times": {"preferred_days": ["friday", "saturday"], "time_range": "8am-5pm"}, "acquisition_cost": 850.00, "property_size_sqft": 6200, "driveway": "double", "garden_type": "low_maintenance", "snow_priority": "high"}'::jsonb),

('CL-RES-004', 'Wilson Townhouse', 'CL-RES-004', 'residential', 'active',
 'Sarah Wilson', 'swilson@rogers.com', '416-555-0104',
 '45 Elm Drive', 'Toronto', 'ON', 'M4W 1N4',
 'Closed Won', 'Residential', 'Social Media', 'Silver',
 '{"acquisition_date": "2022-01-15", "payment_terms": "net-15", "service_categories": ["landscaping", "seasonal_cleanup"], "lifetime_value": 18000.00, "annual_contract_value": 6000.00, "preferred_service_times": {"preferred_days": ["saturday"], "time_range": "9am-1pm"}, "acquisition_cost": 320.00, "property_size_sqft": 1800, "front_yard_only": true, "small_space_design": true, "low_maintenance": true}'::jsonb);

-- Enterprise Commercial Customers
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-COM-001', 'Square One Shopping Centre', 'CL-COM-001', 'commercial', 'active',
 'Jennifer Walsh', 'jennifer.walsh@squareone.com', '905-555-0201',
 '100 City Centre Dr', 'Mississauga', 'ON', 'L5B 2C9',
 'Closed Won', 'Commercial', 'Direct', 'Platinum',
 '{"acquisition_date": "2020-01-15", "payment_terms": "net-45", "service_categories": ["landscaping", "snow_removal", "seasonal_decorations"], "lifetime_value": 500000.00, "annual_contract_value": 120000.00, "preferred_service_times": {"service_windows": "off_hours", "coordination_required": true, "seasonal_intensive": true}, "acquisition_cost": 12500.00, "property_size_acres": 85, "foot_traffic": "high", "seasonal_decorations": true, "public_space": true, "media_visibility": true}'::jsonb),

('CL-COM-002', 'Sheridan College', 'CL-COM-002', 'commercial', 'active',
 'Mark Patterson', 'mark.patterson@sheridancollege.ca', '905-845-9430',
 '7899 McLaughlin Rd', 'Brampton', 'ON', 'L6Y 5H9',
 'Closed Won', 'Commercial', 'Direct', 'Platinum',
 '{"acquisition_date": "2020-12-01", "payment_terms": "net-60", "service_categories": ["landscaping", "snow_removal", "grounds_maintenance"], "lifetime_value": 450000.00, "annual_contract_value": 150000.00, "preferred_service_times": {"academic_calendar_sensitive": true, "student_safety": "priority", "environmental_education": true}, "acquisition_cost": 15000.00, "campus_acres": 125, "buildings": 12, "parking_lots": 8, "environmental_certification": "LEED", "student_population": 23000}'::jsonb),

('CL-COM-004', 'Ontario Power Generation', 'CL-COM-004', 'commercial', 'active',
 'Jennifer Clarke', 'jennifer.clarke@opg.com', '905-839-6000',
 '700 University Ave', 'Toronto', 'ON', 'M5G 1X6',
 'Closed Won', 'Industrial', 'Direct', 'Platinum',
 '{"acquisition_date": "2021-03-01", "payment_terms": "net-45", "service_categories": ["landscaping", "grounds_maintenance", "environmental_compliance"], "lifetime_value": 650000.00, "annual_contract_value": 180000.00, "preferred_service_times": {"security_clearance_required": true, "environmental_strict": true, "safety_protocols": "nuclear"}, "acquisition_cost": 18000.00, "facilities": 15, "environmental_compliance": "nuclear", "security_level": "high", "specialized_equipment": true}'::jsonb);

-- Municipal Government Customers
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-MUN-001', 'City of Mississauga', 'CL-MUN-001', 'municipal', 'active',
 'Paul Martineau', 'paul.martineau@mississauga.ca', '905-615-3200',
 '300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1',
 'Closed Won', 'Government', 'Direct', 'Platinum',
 '{"acquisition_date": "2021-09-15", "payment_terms": "net-45", "service_categories": ["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"], "lifetime_value": 750000.00, "annual_contract_value": 250000.00, "preferred_service_times": {"public_hours_coordination": true, "environmental_compliance": "strict", "public_safety": "priority"}, "acquisition_cost": 25000.00, "parks": 45, "public_spaces_acres": 2500, "environmental_standards": "highest", "public_visibility": "maximum", "citizen_satisfaction": "critical"}'::jsonb);

-- Healthcare and Senior Living
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-COM-006', 'Trillium Health Partners', 'CL-COM-006', 'commercial', 'active',
 'Dr. Patricia Moore', 'patricia.moore@thp.ca', '905-848-7100',
 '100 Queensway W', 'Mississauga', 'ON', 'L5B 1B8',
 'Closed Won', 'Commercial', 'Direct', 'Gold',
 '{"acquisition_date": "2021-11-01", "payment_terms": "net-60", "service_categories": ["landscaping", "grounds_maintenance", "healing_gardens", "accessibility"], "lifetime_value": 520000.00, "annual_contract_value": 160000.00, "preferred_service_times": {"patient_care": "priority", "accessibility": "full", "healing_environment": true, "infection_control": true}, "acquisition_cost": 16000.00, "campus_acres": 45, "buildings": 8, "healing_gardens": 6, "patient_capacity": 850, "staff": 3200}'::jsonb),

('CL-COM-007', 'Amica Senior Living', 'CL-COM-007', 'commercial', 'active',
 'Carol Henderson', 'carol.henderson@amica.ca', '905-607-5050',
 '3180 Kirwin Ave', 'Mississauga', 'ON', 'L5A 3R2',
 'Closed Won', 'Commercial', 'Referral', 'Gold',
 '{"acquisition_date": "2022-02-15", "payment_terms": "net-45", "service_categories": ["landscaping", "seasonal_maintenance", "accessible_gardens", "safety_focus"], "lifetime_value": 340000.00, "annual_contract_value": 95000.00, "preferred_service_times": {"senior_safety": "priority", "accessible_design": true, "seasonal_activities": true}, "acquisition_cost": 9500.00, "residents": 220, "staff": 85, "garden_areas": 4, "accessibility_features": "full", "memory_care": true}'::jsonb);

-- Industrial Manufacturing
INSERT INTO app.d_cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__industry_sector, dl__acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-COM-008', 'Magna International', 'CL-COM-008', 'commercial', 'active',
 'Thomas Weber', 'thomas.weber@magna.com', '905-726-2462',
 '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1',
 'Closed Won', 'Industrial', 'Direct', 'Platinum',
 '{"acquisition_date": "2020-09-15", "payment_terms": "net-60", "service_categories": ["landscaping", "industrial_grounds", "snow_removal", "parking_maintenance"], "lifetime_value": 890000.00, "annual_contract_value": 280000.00, "preferred_service_times": {"industrial_safety": "critical", "employee_parking": "priority", "environmental_compliance": "strict"}, "acquisition_cost": 28000.00, "facilities": 35, "employees": 15000, "parking_spaces": 8500, "manufacturing_sites": true, "environmental_certification": "ISO14001"}'::jsonb);