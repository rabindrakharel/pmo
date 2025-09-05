-- ============================================================================
-- WORKSITE SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Physical worksite dimension representing operational facilities, project
--   locations, and service delivery sites. Provides foundation for resource
--   allocation, equipment management, safety compliance, and operational
--   coordination across all service delivery locations.
--
-- Worksite Categories:
--   - Headquarters: Corporate headquarters and primary operational facilities
--   - Branch: Regional branch offices and service centers
--   - Project: Project-specific worksites and temporary locations
--   - Storage: Equipment storage and inventory management facilities
--   - Seasonal: Seasonal operational sites (winter storage, summer staging)
--
-- Integration:
--   - References d_scope_org for geographic placement
--   - Supports project-based resource allocation and coordination
--   - Enables safety compliance and regulatory reporting
--   - Facilitates equipment and inventory management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_worksite (
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

  -- Worksite identification
  worksite_code text,
  worksite_type text NOT NULL DEFAULT 'project',
  
  -- Location and contact
  org_id uuid REFERENCES app.d_scope_org(id),
  addr text,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  time_zone text DEFAULT 'America/Toronto',
  
  -- Operational attributes
  capacity_workers int,
  equipment_storage boolean DEFAULT false,
  vehicle_parking int,
  security_required boolean DEFAULT false,
  
  -- Facility specifications
  indoor_space_sqft numeric(10,2),
  outdoor_space_sqft numeric(10,2),
  office_space boolean DEFAULT false,
  washroom_facilities boolean DEFAULT false,
  power_available boolean DEFAULT false,
  water_available boolean DEFAULT false,
  
  -- Safety and compliance
  safety_rating text,
  safety_last_inspection date,
  environmental_permits jsonb DEFAULT '[]'::jsonb,
  
  -- Project association
  project_id uuid,
  seasonal_use boolean DEFAULT false,
  seasonal_period text,
  
  -- Contact information
  site_manager_id uuid,
  emergency_contact jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Worksite Network

-- Corporate Headquarters
WITH mississauga_addr AS (
  SELECT id FROM app.d_scope_org 
  WHERE name = '1250 South Service Rd, Mississauga, ON L5E 1V4'
)
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code, 
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking, 
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space, 
  washroom_facilities, power_available, water_available, safety_rating, 
  safety_last_inspection, project_id, seasonal_use, tags, attr
)
SELECT 
  'Huron Home Services HQ',
  'Corporate headquarters and primary operational facility with administrative offices, equipment storage, vehicle maintenance, and dispatch coordination',
  'HHS-HQ',
  'headquarters',
  mississauga_addr.id,
  '1250 South Service Rd, Mississauga, ON',
  'L5E 1V4',
  43.5890,
  -79.6441,
  150,
  true,
  75,
  true,
  25000.00,
  50000.00,
  true,
  true,
  true,
  true,
  'A+',
  CURRENT_DATE - INTERVAL '30 days',
  NULL,
  false,
  '["headquarters", "operational", "administrative", "secure"]'::jsonb,
  '{
    "headquarters": true, "dispatch_center": true, "equipment_maintenance": true, 
    "training_facility": true, "administrative_offices": true, "secure_storage": true,
    "vehicle_fleet_base": true, "emergency_response_center": true
  }'::jsonb
FROM mississauga_addr;

-- Branch Office - Toronto
WITH toronto AS (SELECT id FROM app.d_scope_org WHERE name = 'Toronto')
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, project_id, seasonal_use, tags, attr
) VALUES
('Toronto Service Center',
 'Regional service center providing equipment storage, crew coordination, and client support for Toronto market operations',
 'HHS-TOR-SC',
 'branch',
 (SELECT id FROM app.d_scope_org WHERE name = 'Toronto'),
 '2500 Dundas St W, Toronto, ON',
 'M6P 1X7',
 43.6532,
 -79.4647,
 75,
 true,
 40,
 true,
 12000.00,
 25000.00,
 true,
 true,
 true,
 true,
 'A',
 CURRENT_DATE - INTERVAL '45 days',
 NULL,
 false,
 '["branch", "service-center", "regional", "toronto"]'::jsonb,
 '{
   "regional_hub": true, "equipment_staging": true, "crew_coordination": true,
   "client_support": true, "urban_operations": true, "high_density_market": true
 }'::jsonb);

-- Seasonal Winter Operations Center
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, project_id, seasonal_use, seasonal_period, tags, attr
) VALUES
('Winter Ops - Equipment Staging',
 'Seasonal winter operations facility for snow removal equipment staging, salt storage, and emergency response coordination',
 'HHS-WINTER-STG',
 'seasonal',
 (SELECT id FROM app.d_scope_org WHERE name = 'Hamilton CMA'),
 '1500 Industrial Dr, Hamilton, ON',
 'L8N 3T1',
 43.2557,
 -79.8711,
 50,
 true,
 100,
 true,
 8000.00,
 75000.00,
 false,
 true,
 true,
 true,
 'A',
 CURRENT_DATE - INTERVAL '15 days',
 NULL,
 true,
 'winter',
 '["seasonal", "winter", "equipment", "emergency"]'::jsonb,
 '{
   "seasonal_operations": true, "salt_storage_capacity": "200_tons", 
   "snow_plow_storage": 25, "emergency_response": true, 
   "24_7_operations": true, "heated_facilities": true
 }'::jsonb);

-- Project-Specific Worksites
-- Solar Installation Project Worksite
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, seasonal_use, tags, attr
) VALUES
('Solar Install - 1847 Sheridan Park Dr',
 'Temporary project worksite for residential solar panel installation with equipment staging and crew coordination',
 'HHS-SOL-1847',
 'project',
 (SELECT id FROM app.d_scope_org WHERE name = 'Oakville'),
 '1847 Sheridan Park Dr, Oakville, ON',
 'L6H 7S3',
 43.4675,
 -79.6877,
 15,
 true,
 8,
 false,
 0.00,
 2000.00,
 false,
 false,
 true,
 false,
 'B+',
 CURRENT_DATE - INTERVAL '7 days',
 false,
 '["project", "solar", "residential", "temporary"]'::jsonb,
 '{
   "project_specific": true, "solar_installation": true, "residential_client": true,
   "equipment_staging": true, "temporary_setup": true, "client_property": true
 }'::jsonb);

-- Large Commercial Landscaping Project
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, seasonal_use, tags, attr
) VALUES
('Landscaping - Square One Plaza',
 'Commercial landscaping project worksite for Square One Shopping Centre plaza renovation and maintenance',
 'HHS-LAND-SQ1',
 'project',
 (SELECT id FROM app.d_scope_org WHERE name = 'City Centre'),
 '100 City Centre Dr, Mississauga, ON',
 'L5B 2C9',
 43.5931,
 -79.6424,
 25,
 true,
 15,
 true,
 500.00,
 5000.00,
 false,
 true,
 true,
 true,
 'A',
 CURRENT_DATE - INTERVAL '10 days',
 false,
 '["project", "commercial", "landscaping", "plaza"]'::jsonb,
 '{
   "commercial_project": true, "high_visibility": true, "public_access": true,
   "retail_environment": true, "premium_standards": true, "ongoing_maintenance": true
 }'::jsonb);

-- Equipment Storage and Maintenance Facility
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, org_id, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, seasonal_use, tags, attr
) VALUES
('Equipment Storage - Meadowvale',
 'Dedicated equipment storage and maintenance facility for landscaping and technical service equipment',
 'HHS-EQUIP-MV',
 'storage',
 (SELECT id FROM app.d_scope_org WHERE name = 'Meadowvale'),
 '3850 Ridgeway Dr, Mississauga, ON',
 'L5N 5S6',
 43.5833,
 -79.7333,
 20,
 true,
 50,
 true,
 15000.00,
 40000.00,
 false,
 true,
 true,
 true,
 'A',
 CURRENT_DATE - INTERVAL '20 days',
 false,
 '["storage", "equipment", "maintenance", "secure"]'::jsonb,
 '{
   "equipment_storage": true, "maintenance_facility": true, "secure_compound": true,
   "inventory_management": true, "repair_capabilities": true, "parts_storage": true
 }'::jsonb);

-- Indexes removed for simplified import