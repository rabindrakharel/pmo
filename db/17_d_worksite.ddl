-- ============================================================================
-- WORKSITE ENTITY (d_worksite) - PHYSICAL LOCATIONS
-- ============================================================================
--
-- SEMANTICS:
-- • Physical operational facilities, project locations, service delivery sites
-- • Foundation for resource allocation, equipment management, safety compliance
-- • Categories: headquarters, branch, project, storage, seasonal
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, active_flag=true
-- • UPDATE: Same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now()
-- • LIST: Filter by worksite_type, geocoding
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • code: varchar, worksite_type: text (headquarters, branch, project, storage, seasonal)
-- • addr, postal_code: text, latitude, longitude: numeric
-- • capacity_workers, vehicle_parking: int
-- • equipment_storage_flag, security_required_flag: boolean
-- • indoor_space_sqft, outdoor_space_sqft: numeric
-- • power_available_flag, water_available_flag: boolean
--
-- RELATIONSHIPS:
-- • RBAC: entity_id_rbac_map
--
-- ============================================================================

CREATE TABLE app.d_worksite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (common across all entities) - ALWAYS FIRST
  code varchar(100),
  name text NOT NULL,
  descr text,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version int DEFAULT 1,

  -- Entity metadata (new standard)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Worksite-specific fields
  worksite_type text NOT NULL DEFAULT 'project',

  -- Location and organizational context (no direct FKs - use entity_id_hierarchy_mapping)
  addr text,
  postal_code text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  time_zone text DEFAULT 'America/Toronto',

  -- Operational attributes
  capacity_workers int,
  equipment_storage_flag boolean DEFAULT false,
  vehicle_parking int,
  security_required_flag boolean DEFAULT false,

  -- Facility specifications
  indoor_space_sqft numeric(10,2),
  outdoor_space_sqft numeric(10,2),
  office_space_flag boolean DEFAULT false,
  washroom_facilities_flag boolean DEFAULT false,
  power_available_flag boolean DEFAULT false,
  water_available_flag boolean DEFAULT false,

  -- Safety and compliance
  safety_rating text,
  safety_last_inspection_date date,
  environmental_permits jsonb DEFAULT '[]'::jsonb,

  -- Seasonal operations
  seasonal_use_flag boolean DEFAULT false,
  seasonal_period text,

  -- Management and emergency (no direct FK - use entity_id_hierarchy_mapping)
  emergency_contact jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Worksite Network
-- Comprehensive worksite data covering all operational facility types

-- Corporate Headquarters
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage_flag, vehicle_parking,
  security_required_flag, indoor_space_sqft, outdoor_space_sqft, office_space_flag,
  washroom_facilities_flag, power_available_flag, water_available_flag, safety_rating,
  safety_last_inspection_date, seasonal_use_flag, metadata
) VALUES
('HHS-HQ', 'Huron Home Services HQ',
 'Corporate headquarters and primary operational facility with administrative offices, equipment storage, vehicle maintenance, and dispatch coordination',
 'headquarters',
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
 false,
 '{
   "headquarters": true, "dispatch_center": true, "equipment_maintenance": true,
   "training_facility": true, "administrative_offices": true, "secure_storage": true,
   "vehicle_fleet_base": true, "emergency_response_center": true
 }'::jsonb);

-- Branch Office - Toronto Service Center
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage_flag, vehicle_parking,
  security_required_flag, indoor_space_sqft, outdoor_space_sqft, office_space_flag,
  washroom_facilities_flag, power_available_flag, water_available_flag, safety_rating,
  safety_last_inspection_date, seasonal_use_flag, metadata
) VALUES
('HHS-TOR-SC', 'Toronto Service Center',
 'Regional service center providing equipment storage, crew coordination, and client support for Toronto market operations',
 'branch',
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
 false,
 '{
   "regional_hub": true, "equipment_staging": true, "crew_coordination": true,
   "client_support": true, "urban_operations": true, "high_density_market": true
 }'::jsonb);

-- Seasonal Winter Operations Center
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage, vehicle_parking,
  security_required, indoor_space_sqft, outdoor_space_sqft, office_space,
  washroom_facilities, power_available, water_available, safety_rating,
  safety_last_inspection, seasonal_use, seasonal_period, metadata
) VALUES
('HHS-WINTER-STG', 'Winter Ops - Equipment Staging',
 'Seasonal winter operations facility for snow removal equipment staging, salt storage, and emergency response coordination',
 'seasonal',
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
 true,
 'winter',
 '{
   "seasonal_operations": true, "salt_storage_capacity": "200_tons",
   "snow_plow_storage": 25, "emergency_response": true,
   "24_7_operations": true, "heated_facilities": true
 }'::jsonb);

-- Project-Specific Worksite - Solar Installation
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage_flag, vehicle_parking,
  security_required_flag, indoor_space_sqft, outdoor_space_sqft, office_space_flag,
  washroom_facilities_flag, power_available_flag, water_available_flag, safety_rating,
  safety_last_inspection_date, seasonal_use_flag, metadata
) VALUES
('HHS-SOL-1847', 'Solar Install - 1847 Sheridan Park Dr',
 'Temporary project worksite for residential solar panel installation with equipment staging and crew coordination',
 'project',
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
 '{
   "project_specific": true, "solar_installation": true, "residential_client": true,
   "equipment_staging": true, "temporary_setup": true, "client_property": true
 }'::jsonb);

-- Commercial Landscaping Project Worksite
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage_flag, vehicle_parking,
  security_required_flag, indoor_space_sqft, outdoor_space_sqft, office_space_flag,
  washroom_facilities_flag, power_available_flag, water_available_flag, safety_rating,
  safety_last_inspection_date, seasonal_use_flag, metadata
) VALUES
('HHS-LAND-SQ1', 'Landscaping - Square One Plaza',
 'Commercial landscaping project worksite for Square One Shopping Centre plaza renovation and maintenance',
 'project',
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
 '{
   "commercial_project": true, "high_visibility": true, "public_access": true,
   "retail_environment": true, "premium_standards": true, "ongoing_maintenance": true
 }'::jsonb);

-- Equipment Storage and Maintenance Facility
INSERT INTO app.d_worksite (code, name, "descr", worksite_type, addr, postal_code,
  latitude, longitude, capacity_workers, equipment_storage_flag, vehicle_parking,
  security_required_flag, indoor_space_sqft, outdoor_space_sqft, office_space_flag,
  washroom_facilities_flag, power_available_flag, water_available_flag, safety_rating,
  safety_last_inspection_date, seasonal_use_flag, metadata
) VALUES
('HHS-EQUIP-MV', 'Equipment Storage - Meadowvale',
 'Dedicated equipment storage and maintenance facility for landscaping and technical service equipment',
 'storage',
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
 '{
   "equipment_storage": true, "maintenance_facility": true, "secure_compound": true,
   "inventory_management": true, "repair_capabilities": true, "parts_storage": true
 }'::jsonb);