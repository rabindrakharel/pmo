-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Worksite scope hierarchy representing physical sites where work is performed 
-- or projects are executed. Different from location scope in that worksites are 
-- specific operational facilities linked to both geographic locations and business units.
--
-- Key Features:
-- • Physical operations management and resource allocation
-- • Site-specific safety protocols and compliance requirements
-- • Integration with location and business dimensions
-- • Support for temporary and permanent operational facilities

-- ============================================================================
-- DDL:
-- ============================================================================


CREATE TABLE app.d_scope_worksite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Worksite-specific fields
  worksite_code text,
  worksite_type text DEFAULT 'office',
  operational_status text DEFAULT 'active',
  loc_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  biz_id uuid,
  security_level text DEFAULT 'standard',
  access_hours jsonb DEFAULT '{"weekdays": "08:00-18:00", "weekend": "closed"}'::jsonb,
  emergency_contacts jsonb DEFAULT '[]'::jsonb,
  safety_protocols jsonb DEFAULT '{}'::jsonb,
  geom geometry(Geometry, 4326),
  timezone text DEFAULT 'America/Toronto'
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Huron Home Services Worksite Infrastructure (Office locations and client worksites)
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, operational_status,
  loc_id, security_level, access_hours, emergency_contacts, safety_protocols,
  timezone, from_ts, tags, attr
) VALUES

-- ============ HURON OFFICE LOCATIONS ============
-- Mississauga Headquarters
('Huron Home Services HQ', 'Corporate headquarters with dispatch center, equipment depot, and administrative offices serving the Greater Toronto Area', 'HURON-HQ-MIS', 'headquarters', 'active', (SELECT id FROM app.d_scope_org WHERE name = '1250 South Service Rd, Mississauga, ON L5E 1V4'), 'standard', '{"weekdays": "06:00-20:00", "weekend": "07:00-19:00", "holidays": "emergency_only"}'::jsonb, '[{"type": "office_manager", "name": "Sarah Chen", "phone": "+1-905-555-2001"}, {"type": "security", "name": "Building Security", "phone": "+1-905-555-0911"}]'::jsonb, '{"safety_equipment": "First aid stations, AED, Fire extinguishers", "vehicle_safety": "Pre-trip inspections required", "ppe_required": true}'::jsonb, 'America/Toronto', now(), '["headquarters", "dispatch", "depot", "admin"]', '{"building_type": "industrial_office", "office_sqft": 15000, "depot_sqft": 8000, "vehicle_capacity": 25, "dispatch_center": true}'),

-- Toronto Branch Office
('Huron Toronto Branch', 'Toronto branch office and equipment staging area serving Toronto and North York districts', 'HURON-TOR-BR', 'branch_office', 'active', (SELECT id FROM app.d_scope_org WHERE name = '85 Bentley Ave, Toronto, ON M6N 2W7'), 'standard', '{"weekdays": "06:30-19:00", "weekend": "08:00-17:00", "holidays": "closed"}'::jsonb, '[{"type": "branch_manager", "name": "Operations Supervisor", "phone": "+1-416-555-2100"}, {"type": "emergency", "name": "Emergency Services", "phone": "911"}]'::jsonb, '{"customer_entrance": "Separate customer entrance", "staging_protocols": "Equipment check-in/out log", "vehicle_maintenance": "Basic maintenance bay"}'::jsonb, 'America/Toronto', now(), '["branch", "customer_service", "staging"]', '{"building_type": "industrial", "office_sqft": 8000, "staging_sqft": 5000, "customer_entrance": true, "vehicle_capacity": 12}'),

-- London Regional Office
('Huron London Office', 'Regional office for London and Southwestern Ontario market expansion and contractor coordination', 'HURON-LON-REG', 'regional_office', 'active', (SELECT id FROM app.d_scope_org WHERE name = '467 Talbot St, London, ON N6A 2S5'), 'standard', '{"weekdays": "07:00-18:00", "weekend": "closed", "holidays": "closed"}'::jsonb, '[{"type": "regional_manager", "name": "Regional Coordinator", "phone": "+1-519-555-3000"}, {"type": "contractor_liaison", "name": "Contractor Services", "phone": "+1-519-555-3001"}]'::jsonb, '{"meeting_protocols": "Contractor safety briefings", "local_compliance": "London municipal requirements", "emergency_procedures": "Regional emergency contacts"}'::jsonb, 'America/Toronto', now(), '["regional", "coordination", "expansion"]', '{"building_type": "office", "office_sqft": 4500, "meeting_rooms": 3, "contractor_coordination": true, "regional_coverage": "southwestern_ontario"}'),

-- ============ CLIENT WORKSITES (Representative Examples) ============
-- Residential Client Site - Mississauga
('Residential - 1255 Lakeshore Rd W', 'High-end residential property requiring comprehensive landscaping, seasonal maintenance, and home system services', 'CLIENT-RES-001', 'residential', 'active', (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga Central'), 'client_site', '{"access": "homeowner_permission", "service_windows": "08:00-18:00", "weekend": "09:00-17:00"}'::jsonb, '[{"type": "homeowner", "name": "Johnson Family", "phone": "+1-905-555-1001"}, {"type": "emergency", "name": "Huron Dispatch", "phone": "+1-905-555-0911"}]'::jsonb, '{"property_access": "Key lockbox", "pet_considerations": "Two dogs - gate protocol", "service_restrictions": "No work during family events"}'::jsonb, 'America/Toronto', now(), '["residential", "premium", "multi_service"]', '{"property_size": "0.75_acres", "services": ["landscaping", "snow_removal", "plumbing", "electrical"], "annual_contract": true, "property_value": "$1.2M"}'),

-- Commercial Client Site - Toronto
('Commercial - 4600 Dufferin St', 'Large commercial plaza requiring landscaping maintenance, snow removal, and facility maintenance services', 'CLIENT-COM-002', 'commercial', 'active', (SELECT id FROM app.d_scope_org WHERE name = 'Toronto North York'), 'client_site', '{"access": "property_manager_approval", "service_windows": "06:00-22:00", "weekend": "08:00-20:00"}'::jsonb, '[{"type": "property_manager", "name": "Commercial Property Management", "phone": "+1-416-555-2001"}, {"type": "security", "name": "Plaza Security", "phone": "+1-416-555-2002"}]'::jsonb, '{"vehicle_access": "Service entrance required", "parking_coordination": "Avoid peak hours", "emergency_access": "24/7 for snow removal"}'::jsonb, 'America/Toronto', now(), '["commercial", "plaza", "multi_service"]', '{"property_type": "retail_plaza", "area_sqft": 250000, "services": ["landscaping", "snow_removal", "hvac_maintenance"], "tenant_count": 45, "contract_type": "multi_year"}'),

-- Municipal Client Site - London
('Municipal - Springbank Park', 'Municipal park requiring specialized landscaping, tree care, and seasonal maintenance under municipal contracts', 'CLIENT-MUN-003', 'municipal', 'active', (SELECT id FROM app.d_scope_org WHERE name = 'London East'), 'public_site', '{"access": "municipal_authorization", "service_windows": "07:00-15:00", "weekend": "08:00-16:00"}'::jsonb, '[{"type": "parks_department", "name": "City of London Parks", "phone": "+1-519-555-3100"}, {"type": "site_supervisor", "name": "Park Operations", "phone": "+1-519-555-3101"}]'::jsonb, '{"public_safety": "Public access considerations", "environmental_protocols": "Eco-friendly practices only", "seasonal_restrictions": "Wildlife nesting seasons"}'::jsonb, 'America/Toronto', now(), '["municipal", "public", "environmental"]', '{"contract_authority": "City of London", "area_acres": 75, "services": ["tree_care", "landscaping", "irrigation"], "environmental_certification": "required", "public_visibility": "high"}'),

-- Emergency Service Site - Various
('Emergency Response - Mobile', 'Mobile emergency response service site for urgent plumbing, electrical, and heating system failures', 'EMERGENCY-MOB-999', 'emergency', 'active', NULL, 'emergency', '{"access": "24_7", "response_time": "within_2_hours", "priority": "emergency_only"}'::jsonb, '[{"type": "dispatch", "name": "Huron Emergency Dispatch", "phone": "+1-905-555-0911"}, {"type": "supervisor", "name": "On-call Supervisor", "phone": "+1-905-555-0912"}]'::jsonb, '{"safety_protocols": "Emergency response procedures", "equipment_ready": "Mobile emergency kit", "customer_communication": "Immediate status updates"}'::jsonb, 'America/Toronto', now(), '["emergency", "mobile", "urgent"]', '{"service_type": "emergency_response", "coverage_area": "GTA_and_London", "response_guarantee": "2_hour_arrival", "available_services": ["plumbing", "electrical", "heating"], "premium_rate": true}'),

-- Seasonal Worksite - Winter Operations
('Winter Ops - Equipment Staging', 'Temporary winter operations staging area for snow removal equipment and seasonal staff coordination', 'WINTER-STAGE-001', 'seasonal', 'active', (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga Central'), 'standard', '{"season": "November_to_March", "access": "24_7_during_snow", "staging": "04:00-08:00"}'::jsonb, '[{"type": "winter_ops_manager", "name": "Frank Kowalski", "phone": "+1-905-555-8001"}, {"type": "equipment_dispatch", "name": "Winter Dispatch", "phone": "+1-905-555-8002"}]'::jsonb, '{"equipment_protocols": "Pre-storm equipment check", "salt_storage": "Covered storage requirements", "weather_monitoring": "Continuous weather tracking"}'::jsonb, 'America/Toronto', now(), '["seasonal", "winter", "equipment", "staging"]', '{"season_duration": "5_months", "equipment_capacity": "15_vehicles", "salt_storage_tons": 200, "crew_capacity": 25, "weather_response": "automated_callout"}'),

-- Solar Installation Worksite - Residential
('Solar Install - 1847 Sheridan Park Dr', 'Residential solar panel installation project requiring roof access, electrical work, and system commissioning', 'SOLAR-RES-004', 'installation', 'temporary', (SELECT id FROM app.d_scope_org WHERE name = 'Mississauga Central'), 'client_site', '{"project_duration": "3_days", "access": "homeowner_supervised", "weather_dependent": true}'::jsonb, '[{"type": "homeowner", "name": "Green Family", "phone": "+1-905-555-4001"}, {"type": "installer", "name": "Ahmed Hassan", "phone": "+1-519-555-9001"}]'::jsonb, '{"roof_safety": "Fall protection required", "electrical_safety": "Power shutdown procedures", "weather_protocols": "No work in high winds or rain"}'::jsonb, 'America/Toronto', now(), '["solar", "installation", "renewable", "temporary"]', '{"installation_type": "residential_rooftop", "system_size_kw": 8.5, "permit_required": true, "inspection_scheduled": true, "warranty_period": "25_years", "estimated_completion": "3_days"}');
;

-- Indexes intentionally omitted in this simplified DDL; add as needed later.
