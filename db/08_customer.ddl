-- ============================================================================
-- CUSTOMER ENTITY (d_cust) - CORE ENTITY
-- Customer relationship management across residential, commercial, municipal, industrial sectors
-- ============================================================================
--
-- SEMANTICS:
-- Customer entities representing service recipients across residential, commercial, municipal,
-- and industrial sectors. Foundation for relationship management, service delivery, contract
-- tracking, and revenue attribution. Customers own projects and receive services.
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/cust, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/cust/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/cust/{id}, active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/cust, filters by cust_type/cust_status/customer_tier, RBAC enforced
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE CUSTOMER
--    • Endpoint: POST /api/v1/cust
--    • Body: {name, code, cust_number, cust_type, cust_status, primary_contact_name, primary_email, primary_phone, primary_address, city, province}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='cust', entity_id='11111111-1111-1111-1111-111111111111'
--    • Business Rule: cust_number must be unique; cust_type validates against ('residential', 'commercial', 'municipal', 'industrial')
--
-- 2. UPDATE CUSTOMER (Contact Changes, Status Updates, Relationship Upgrades)
--    • Endpoint: PUT /api/v1/cust/{id}
--    • Body: {primary_contact_name, primary_email, cust_status, opportunity_funnel_stage_name, customer_tier_name}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves all project relationships and service history)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - NO archival (customer tier can change: Lead → Prospect → Active Customer)
--    • RBAC: Requires permission 1 (edit) on entity='cust', entity_id={id} OR '11111111-1111-1111-1111-111111111111'
--    • Business Rule: Changing dl__customer_opportunity_funnel reflects sales pipeline progress
--
-- 3. SOFT DELETE CUSTOMER (Account Closure)
--    • Endpoint: DELETE /api/v1/cust/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now(), cust_status='inactive' WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Preserves all historical projects and service records; customer hidden from active lists
--
-- 4. LIST CUSTOMERS (Filtered by Type, Status, Tier)
--    • Endpoint: GET /api/v1/cust?cust_type=commercial&customer_tier_name=Enterprise&limit=50
--    • Database:
--      SELECT c.* FROM d_cust c
--      WHERE c.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_rbac rbac
--          WHERE rbac.person_code='employee' AND rbac.person_id=$user_id
--            AND rbac.entity='cust'
--            AND (rbac.entity_id=c.id::text OR rbac.entity_id='11111111-1111-1111-1111-111111111111')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY c.dl__customer_tier DESC, c.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY customers they have view access to
--    • Frontend: Renders in EntityListOfInstancesPage with table view + advanced filtering
--
-- 5. GET SINGLE CUSTOMER
--    • Endpoint: GET /api/v1/cust/{id}
--    • Database: SELECT * FROM d_cust WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_rbac for view permission
--    • Frontend: EntitySpecificInstancePage renders fields + tabs for projects/tasks/forms
--
-- 6. GET CUSTOMER PROJECTS
--    • Endpoint: GET /api/v1/cust/{id}/project?project_stage=Execution&limit=20
--    • Database:
--      SELECT p.* FROM d_project p
--      INNER JOIN entity_id_map eim ON eim.child_entity_instance_id=p.id
--      WHERE eim.entity_instance_id=$1
--        AND eim.entity_code='cust'
--        AND eim.child_entity_code='project'
--        AND p.active_flag=true
--      ORDER BY p.created_ts DESC
--    • Relationship: Via entity_id_map (flexible customer-project relationships)
--    • Frontend: Renders in DynamicChildEntityTabs component
--
-- 7. GET CUSTOMER REVENUE SUMMARY
--    • Endpoint: GET /api/v1/cust/{id}/revenue-summary
--    • Database: Aggregates project budgets and metadata fields
--      SELECT
--        c.metadata->>'lifetime_value' AS lifetime_value,
--        c.metadata->>'annual_contract_value' AS annual_contract_value,
--        COUNT(p.id) AS project_count,
--        SUM(p.budget_spent) AS total_project_spending
--      FROM d_cust c
--      LEFT JOIN entity_id_map eim ON eim.entity_instance_id=c.id AND eim.entity_code='cust'
--      LEFT JOIN d_project p ON p.id=eim.child_entity_instance_id AND p.active_flag=true
--      WHERE c.id=$1
--      GROUP BY c.id
--    • Business Rule: Provides customer lifetime value and project spending analytics
--
-- 8. SALES PIPELINE MOVEMENT (Opportunity Funnel)
--    • Frontend Action: User moves customer from "Lead" to "Qualified" in pipeline view
--    • Endpoint: PUT /api/v1/cust/{id}
--    • Body: {opportunity_funnel_stage_name: "Qualified"}
--    • Database: UPDATE SET opportunity_funnel_stage_name=$1, updated_ts=now(), version=version+1 WHERE id=$2
--    • Business Rule: dl__customer_opportunity_funnel loads from app.setting_datalabel (datalabel_name='opportunity__funnel_stage')
--
-- 9. APP USER SIGNUP (New User Registration)
--    • Endpoint: POST /api/v1/auth/customer/signup
--    • Body: {name, primary_email, password, cust_type}
--    • Database: INSERT with password_hash=bcrypt.hash(password), entities=[], cust_status='active'
--    • Returns: {id, token (JWT)}
--    • Business Rule: Auto-generated cust_number, redirects to entity configuration page
--
-- 10. APP USER SIGNIN (Authentication)
--     • Endpoint: POST /api/v1/auth/customer/signin
--     • Body: {email, password}
--     • Database: SELECT * FROM d_cust WHERE primary_email=$1 AND active_flag=true
--     • Verification: bcrypt.compare(password, password_hash)
--     • Returns: {token (JWT), user: {id, name, email, entities}}
--     • Business Rule: Updates last_login_ts, resets failed_login_attempts
--
-- 11. ENTITY CONFIGURATION (First-Time Setup)
--     • Endpoint: PUT /api/v1/cust/{id}/configure
--     • Body: {entities: ["project", "task", "wiki", "form"]}
--     • Database: UPDATE SET entities=$1, updated_ts=now() WHERE id=$2
--     • Business Rule: Updates user's activated entities, filters sidebar navigation
--     • Frontend: Sidebar only shows entities present in user's entities array
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves project relationships and service history)
-- • version: Increments on updates (audit trail of contact changes, tier upgrades)
-- • from_ts: Customer acquisition date (never modified)
-- • to_ts: Account closure timestamp (NULL=active, timestamptz=closed)
-- • active_flag: Account status (true=active, false=closed/archived)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • cust_number: Unique customer identifier (e.g., CL-RES-001, CL-COM-002)
-- • cust_type: Sector classification ('residential', 'commercial', 'municipal', 'industrial')
-- • cust_status: Account status ('active', 'inactive', 'prospect', 'former')
-- • dl__customer_opportunity_funnel: Sales pipeline stage (Lead, Qualified, Proposal, Closed Won)
--   - Loaded from app.setting_datalabel table (datalabel_name='opportunity__funnel_stage') via GET /api/v1/setting?category=opportunity__funnel_stage
-- • dl__customer_tier: Service tier ('Bronze', 'Silver', 'Gold', 'Platinum')
--   - Loaded from app.setting_datalabel table (datalabel_name='customer__tier') via GET /api/v1/setting?category=customer__tier
-- • dl__customer_industry_sector: Industry classification (Residential, Commercial, Industrial, Government)
--   - Loaded from app.setting_datalabel table (datalabel_name='industry__sector') via GET /api/v1/setting?category=industry__sector
-- • dl__customer_acquisition_channel: How client was acquired (Referral, Organic Search, Direct, Partnership)
--   - Loaded from app.setting_datalabel table (datalabel_name='acquisition__channel') via GET /api/v1/setting?category=acquisition__channel
-- • primary_contact_name, primary_email, primary_phone: Main contact details
-- • metadata: JSONB field storing lifetime_value, annual_contract_value, service_categories, payment_terms
--
-- AUTHENTICATION FIELDS (for app user accounts):
-- • password_hash: bcrypt hashed password (never returned by API, only for app users)
-- • last_login_ts: Session tracking for app users
-- • failed_login_attempts: Security lockout mechanism
-- • account_locked_until: Temporary account lock timestamp
-- • entities: Array of activated entity types (e.g., ['project', 'task', 'wiki'])
--   - Controls which entities appear in sidebar navigation
--   - Configured on first-time login or via settings
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • cust_id ← entity_id_map (projects/tasks/forms linked to customers via mapping table)
-- • Follows flexible relationship model via entity_id_map
--
-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.cust (
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

  -- Customer identification
  cust_number text,
  cust_type text DEFAULT 'residential',
  cust_status text DEFAULT 'active',


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
  dl__customer_opportunity_funnel text,  -- References app.setting_datalabel (datalabel_name='dl__customer_opportunity_funnel')
  dl__customer_industry_sector text,     -- References app.setting_datalabel (datalabel_name='dl__customer_industry_sector')
  dl__customer_acquisition_channel text, -- References app.setting_datalabel (datalabel_name='dl__customer_acquisition_channel')
  dl__customer_tier text,                -- References app.setting_datalabel (datalabel_name='dl__customer_tier')


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
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
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
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
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
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
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
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-MUN-001', 'City of Mississauga', 'CL-MUN-001', 'municipal', 'active',
 'Paul Martineau', 'paul.martineau@mississauga.ca', '905-615-3200',
 '300 City Centre Dr', 'Mississauga', 'ON', 'L5B 3C1',
 'Closed Won', 'Government', 'Direct', 'Platinum',
 '{"acquisition_date": "2021-09-15", "payment_terms": "net-45", "service_categories": ["landscaping", "seasonal_maintenance", "snow_removal", "park_maintenance"], "lifetime_value": 750000.00, "annual_contract_value": 250000.00, "preferred_service_times": {"public_hours_coordination": true, "environmental_compliance": "strict", "public_safety": "priority"}, "acquisition_cost": 25000.00, "parks": 45, "public_spaces_acres": 2500, "environmental_standards": "highest", "public_visibility": "maximum", "citizen_satisfaction": "critical"}'::jsonb);

-- Healthcare and Senior Living
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
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
INSERT INTO app.cust (
  code, name, cust_number, cust_type, cust_status,
  primary_contact_name, primary_email, primary_phone,
  primary_address, city, province, postal_code,
  dl__customer_opportunity_funnel, dl__customer_industry_sector, dl__customer_acquisition_channel, dl__customer_tier,
  metadata
) VALUES
('CL-COM-008', 'Magna International', 'CL-COM-008', 'commercial', 'active',
 'Thomas Weber', 'thomas.weber@magna.com', '905-726-2462',
 '337 Magna Dr', 'Aurora', 'ON', 'L4G 7K1',
 'Closed Won', 'Industrial', 'Direct', 'Platinum',
 '{"acquisition_date": "2020-09-15", "payment_terms": "net-60", "service_categories": ["landscaping", "industrial_grounds", "snow_removal", "parking_maintenance"], "lifetime_value": 890000.00, "annual_contract_value": 280000.00, "preferred_service_times": {"industrial_safety": "critical", "employee_parking": "priority", "environmental_compliance": "strict"}, "acquisition_cost": 28000.00, "facilities": 35, "employees": 15000, "parking_spaces": 8500, "manufacturing_sites": true, "environmental_certification": "ISO14001"}'::jsonb);
