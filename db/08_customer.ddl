-- ============================================================================
-- CUSTOMER ENTITY (customer) - CORE ENTITY
-- ============================================================================
--
-- SEMANTICS:
-- Customer entities representing service recipients across residential, commercial,
-- municipal, and industrial sectors. Personal details (name, address) stored HERE.
-- Authentication handled by app.person table (person_id FK).
--
-- OPERATIONS:
-- • CREATE: First create person record (for auth), then INSERT customer with person_id
-- • SIGNIN: Query person by email, verify password, get customer profile via JOIN
-- • UPDATE: PUT /api/v1/customer/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/customer/{id}, active_flag=false, to_ts=now() (soft delete)
--
-- RELATIONSHIPS (NO FOREIGN KEYS except person_id):
-- • Parent: person (person_id) - for auth/RBAC
-- • Children: projects, tasks, forms (via entity_instance_link)
-- • RBAC: entity_rbac.person_id (via person table)
--
-- ============================================================================

CREATE TABLE app.customer (
  id uuid DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200),
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Link to Person (for auth/RBAC)
  -- ─────────────────────────────────────────────────────────────────────────
  person_id uuid, -- References app.person.id (auth hub)

  -- ─────────────────────────────────────────────────────────────────────────
  -- Customer Identification
  -- ─────────────────────────────────────────────────────────────────────────
  cust_number text,
  cust_type text DEFAULT 'residential', -- residential, commercial, municipal, industrial
  cust_status text DEFAULT 'active',

  -- ─────────────────────────────────────────────────────────────────────────
  -- Personal Information (stored HERE, not in person)
  -- ─────────────────────────────────────────────────────────────────────────
  first_name varchar(100),
  last_name varchar(100),
  company_name varchar(255), -- For commercial/industrial customers

  -- ─────────────────────────────────────────────────────────────────────────
  -- Address and Location
  -- ─────────────────────────────────────────────────────────────────────────
  primary_address text,
  address_line2 text,
  city text,
  province text DEFAULT 'ON',
  postal_code text,
  country text DEFAULT 'Canada',
  geo_coordinates jsonb, -- {"latitude": 43.5890, "longitude": -79.6441}

  -- ─────────────────────────────────────────────────────────────────────────
  -- Business Information
  -- ─────────────────────────────────────────────────────────────────────────
  business_legal_name text,
  business_type text,
  gst_hst_number text,
  business_number text,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Sales and Marketing
  -- ─────────────────────────────────────────────────────────────────────────
  dl__customer_opportunity_funnel text, -- References app.datalabel
  dl__customer_industry_sector text,
  dl__customer_acquisition_channel text,
  dl__customer_tier text,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Contact Information (stored HERE, not in person)
  -- ─────────────────────────────────────────────────────────────────────────
  primary_contact_name text,
  primary_email text, -- Display email (auth uses person.email)
  primary_phone text,
  secondary_contact_name text,
  secondary_email text,
  secondary_phone text,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Entity Configuration (activated entities for app users)
  -- ─────────────────────────────────────────────────────────────────────────
  entities text[] DEFAULT ARRAY[]::text[]
);

COMMENT ON TABLE app.customer IS 'Customer entities with contact info and business details. Auth via app.person (person_id)';
COMMENT ON COLUMN app.customer.person_id IS 'Link to app.person for authentication and RBAC';
COMMENT ON COLUMN app.customer.first_name IS 'Customer first name';
COMMENT ON COLUMN app.customer.last_name IS 'Customer last name';

-- ============================================================================
-- DATA CURATION
-- ============================================================================

-- Premium Residential Customers (with person records for auth)

-- Thompson Family
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-001', 'customer', 'robert.thompson@email.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-RES-001', 'Thompson Family Residence', 'CL-RES-001', 'residential', 'active',
  p.id,
  'Robert', 'Thompson',
  'Robert Thompson', 'robert.thompson@email.com', '416-555-0101',
  '1847 Sheridan Park Dr', 'Oakville', 'ON', 'L6H 7S3',
  'Closed Won', 'Residential', 'Referral', 'Gold',
  '{"acquisition_date": "2021-03-15", "payment_terms": "net-15", "service_categories": ["landscaping", "garden_design", "seasonal_maintenance"], "lifetime_value": 85000.00, "annual_contract_value": 25000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-001';

-- Update person with customer_id
UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-001';

-- Chen Estate
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-002', 'customer', 'david.chen@outlook.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-RES-003', 'The Chen Estate', 'CL-RES-003', 'residential', 'active',
  p.id,
  'David', 'Chen',
  'David Chen', 'david.chen@outlook.com', '905-555-0103',
  '3425 Mississauga Rd', 'Mississauga', 'ON', 'L5L 3R8',
  'Closed Won', 'Residential', 'Referral', 'Gold',
  '{"acquisition_date": "2020-08-10", "payment_terms": "net-30", "service_categories": ["landscaping", "garden_design", "seasonal_maintenance", "pool_maintenance"], "lifetime_value": 120000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-002';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-002';

-- Martinez Family
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-003', 'customer', 'isabella.martinez@gmail.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-RES-002', 'Martinez Family Home', 'CL-RES-002', 'residential', 'active',
  p.id,
  'Isabella', 'Martinez',
  'Isabella Martinez', 'isabella.martinez@gmail.com', '647-555-0102',
  '2156 Lakeshore Rd W', 'Oakville', 'ON', 'L6L 1H2',
  'Closed Won', 'Residential', 'Organic Search', 'Silver',
  '{"acquisition_date": "2021-05-20", "payment_terms": "net-15", "service_categories": ["landscaping", "seasonal_cleanup", "snow_removal"], "lifetime_value": 42000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-003';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-003';

-- Wilson Townhouse
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-004', 'customer', 'swilson@rogers.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-RES-004', 'Wilson Townhouse', 'CL-RES-004', 'residential', 'active',
  p.id,
  'Sarah', 'Wilson',
  'Sarah Wilson', 'swilson@rogers.com', '416-555-0104',
  '45 Elm Drive', 'Toronto', 'ON', 'M4W 1N4',
  'Closed Won', 'Residential', 'Social Media', 'Silver',
  '{"acquisition_date": "2022-01-15", "payment_terms": "net-15", "service_categories": ["landscaping", "seasonal_cleanup"], "lifetime_value": 18000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-004';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-004';

-- Enterprise Commercial Customers (person records for contact persons)

-- Square One Shopping Centre
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-005', 'customer', 'jennifer.walsh@squareone.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-001', 'Square One Shopping Centre', 'CL-COM-001', 'commercial', 'active',
  p.id,
  'Jennifer', 'Walsh', 'Square One Shopping Centre',
  'Jennifer Walsh', 'jennifer.walsh@squareone.com', '905-555-0201',
  '100 City Centre Dr', 'Mississauga', 'ON', 'L5B 2C9',
  'Closed Won', 'Commercial', 'Direct', 'Platinum',
  '{"acquisition_date": "2020-01-15", "payment_terms": "net-45", "service_categories": ["landscaping", "snow_removal", "seasonal_decorations"], "lifetime_value": 500000.00, "annual_contract_value": 120000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-005';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-005';

-- Sheridan College
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-006', 'customer', 'mark.patterson@sheridancollege.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-002', 'Sheridan College', 'CL-COM-002', 'commercial', 'active',
  p.id,
  'Mark', 'Patterson', 'Sheridan College',
  'Mark Patterson', 'mark.patterson@sheridancollege.ca', '905-845-9430',
  '7899 McLaughlin Rd', 'Brampton', 'ON', 'L6Y 5H9',
  'Closed Won', 'Commercial', 'Direct', 'Platinum',
  '{"acquisition_date": "2020-12-01", "payment_terms": "net-60", "service_categories": ["landscaping", "snow_removal", "grounds_maintenance"], "lifetime_value": 450000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-006';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-006';

-- Ontario Power Generation
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-007', 'customer', 'jennifer.clarke@opg.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-004', 'Ontario Power Generation', 'CL-COM-004', 'commercial', 'active',
  p.id,
  'Jennifer', 'Clarke', 'Ontario Power Generation',
  'Jennifer Clarke', 'jennifer.clarke@opg.com', '905-839-6000',
  '700 University Ave', 'Toronto', 'ON', 'M5G 1X6',
  'Closed Won', 'Industrial', 'Direct', 'Platinum',
  '{"acquisition_date": "2021-03-01", "payment_terms": "net-45", "service_categories": ["landscaping", "grounds_maintenance", "environmental_compliance"], "lifetime_value": 650000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-007';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-007';

-- City of Mississauga (Municipal)
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-008', 'customer', 'paul.martineau@mississauga.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-MUN-001', 'City of Mississauga', 'CL-MUN-001', 'municipal', 'active',
  p.id,
  'Paul', 'Martineau', 'City of Mississauga',
  'Paul Martineau', 'paul.martineau@mississauga.ca', '905-615-3200',
  '300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1',
  'Closed Won', 'Government', 'Direct', 'Platinum',
  '{"acquisition_date": "2021-09-15", "payment_terms": "net-45", "service_categories": ["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"], "lifetime_value": 750000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-008';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-008';

-- Healthcare: Trillium Health Partners
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-009', 'customer', 'patricia.moore@thp.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-006', 'Trillium Health Partners', 'CL-COM-006', 'commercial', 'active',
  p.id,
  'Patricia', 'Moore', 'Trillium Health Partners',
  'Dr. Patricia Moore', 'patricia.moore@thp.ca', '905-848-7100',
  '100 Queensway W', 'Mississauga', 'ON', 'L5B 1B8',
  'Closed Won', 'Commercial', 'Direct', 'Gold',
  '{"acquisition_date": "2021-11-01", "payment_terms": "net-60", "service_categories": ["landscaping", "grounds_maintenance", "healing_gardens"], "lifetime_value": 520000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-009';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-009';

-- Senior Living: Amica
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-010', 'customer', 'carol.henderson@amica.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-007', 'Amica Senior Living', 'CL-COM-007', 'commercial', 'active',
  p.id,
  'Carol', 'Henderson', 'Amica Senior Living',
  'Carol Henderson', 'carol.henderson@amica.ca', '905-607-5050',
  '3180 Kirwin Ave', 'Mississauga', 'ON', 'L5A 3R2',
  'Closed Won', 'Commercial', 'Referral', 'Gold',
  '{"acquisition_date": "2022-02-15", "payment_terms": "net-45", "service_categories": ["landscaping", "seasonal_maintenance", "accessible_gardens"], "lifetime_value": 340000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-010';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-010';

-- Industrial: Magna International
INSERT INTO app.person (code, entity_code, email, password_hash, email_verified_flag)
VALUES ('PER-CU-011', 'customer', 'thomas.weber@magna.com', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

INSERT INTO app.customer (
  code, name, cust_number, cust_type, cust_status,
  person_id,
  first_name, last_name, company_name,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
)
SELECT
  'CL-COM-008', 'Magna International', 'CL-COM-008', 'commercial', 'active',
  p.id,
  'Thomas', 'Weber', 'Magna International',
  'Thomas Weber', 'thomas.weber@magna.com', '905-726-2462',
  '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1',
  'Closed Won', 'Industrial', 'Direct', 'Platinum',
  '{"acquisition_date": "2020-09-15", "payment_terms": "net-60", "service_categories": ["landscaping", "industrial_grounds", "snow_removal", "parking_maintenance"], "lifetime_value": 890000.00}'::jsonb
FROM app.person p WHERE p.code = 'PER-CU-011';

UPDATE app.person p SET customer_id = c.id FROM app.customer c WHERE c.person_id = p.id AND p.code = 'PER-CU-011';

-- ============================================================================
-- REGISTER ALL CUSTOMERS IN entity_instance
-- ============================================================================

INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'customer', id, name, code
FROM app.customer
WHERE active_flag = true;

-- ============================================================================
-- Sync person.name from customer first_name/last_name
-- This denormalization enables fast role-person lookups
-- ============================================================================
UPDATE app.person p
SET name = c.first_name || ' ' || c.last_name
FROM app.customer c
WHERE c.person_id = p.id
  AND p.entity_code = 'customer';
