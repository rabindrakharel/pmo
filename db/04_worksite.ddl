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
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
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

-- Insert Canadian Technology Corporation Worksite Infrastructure
INSERT INTO app.d_scope_worksite (
  name, "descr", worksite_code, worksite_type, operational_status,
  loc_id, security_level, access_hours, emergency_contacts, safety_protocols,
  timezone, from_ts, tags, attr
) VALUES

-- Toronto Headquarters (Primary Corporate Office)
('TechCorp Toronto HQ', 'Corporate headquarters and primary development center with executive offices, main development teams, and primary data center', 'TC-TOR-HQ', 'office', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'), 'restricted', '{"weekdays": "06:00-22:00", "weekend": "08:00-18:00", "holidays": "closed"}'::jsonb, '[{"type": "security", "name": "TechCorp Security"}]'::jsonb, '{"fire_evacuation": "Level 1"}'::jsonb, 'America/Toronto', now(), '["headquarters", "development", "datacenter"]', '{"building_class": "Class A", "established": "1995"}'),

-- Toronto Development Center (Secondary Development Site)
('TechCorp Toronto Dev Center', 'Secondary development facility focusing on platform engineering and QA operations', 'TC-TOR-DEV', 'development', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'), 'standard', '{"weekdays": "07:00-20:00", "weekend": "09:00-17:00", "holidays": "closed"}'::jsonb, '[{"type": "security", "name": "Building Security"}]'::jsonb, '{"access_control": "Badge and PIN"}'::jsonb, 'America/Toronto', now(), '["development", "platform", "qa"]', '{"building_class": "Class B+", "established": "2010"}'),

-- London Regional Office
('TechCorp London Office', 'Regional office and client service center for Southwestern Ontario operations', 'TC-LON-REG', 'office', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'London'), 'standard', '{"weekdays": "08:00-17:00", "weekend": "closed", "holidays": "closed"}'::jsonb, '[{"type": "reception", "name": "Reception Desk"}]'::jsonb, '{"visitor_management": "Reception check-in"}'::jsonb, 'America/Toronto', now(), '["regional", "client-service", "sales"]', '{"building_class": "Class B", "established": "2005"}'),

-- Mississauga Distribution Center
('TechCorp Mississauga Logistics', 'Distribution and logistics center for equipment, supplies, and document management', 'TC-MIS-LOG', 'warehouse', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga'), 'standard', '{"weekdays": "06:00-18:00", "weekend": "08:00-16:00", "holidays": "closed"}'::jsonb, '[{"type": "warehouse_manager", "name": "Logistics Manager"}]'::jsonb, '{"forklift_operations": "Licensed operators only"}'::jsonb, 'America/Toronto', now(), '["warehouse", "logistics", "distribution"]', '{"building_class": "Industrial", "established": "2008"}'),

-- Ottawa Client Service Center
('TechCorp Ottawa Client Center', 'Government and enterprise client service delivery center', 'TC-OTT-CLI', 'service', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Ottawa'), 'restricted', '{"weekdays": "07:00-19:00", "weekend": "closed", "holidays": "closed"}'::jsonb, '[{"type": "client_services", "name": "Client Success Manager"}]'::jsonb, '{"government_compliance": "Security clearance required for restricted areas"}'::jsonb, 'America/Toronto', now(), '["client-service", "government", "secure"]', '{"building_class": "Class A", "established": "2012"}'),

-- Montreal Development Lab
('TechCorp Montreal R&D Lab', 'Research and development laboratory for emerging technologies and innovation projects', 'TC-MTL-RND', 'development', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Montreal'), 'confidential', '{"weekdays": "08:00-20:00", "weekend": "10:00-18:00", "holidays": "emergency_access_only"}'::jsonb, '[{"type": "lab_manager", "name": "R&D Lab Director"}]'::jsonb, '{"research_protocols": "Clean room procedures"}'::jsonb, 'America/Toronto', now(), '["research", "development", "innovation", "lab"]', '{"building_class": "Research", "established": "2015"}'),

-- Vancouver Remote Hub
('TechCorp Vancouver Hub', 'Remote work hub and client engagement center for Pacific region operations', 'TC-VAN-HUB', 'office', 'active', (SELECT id FROM app.d_scope_location WHERE name = 'Vancouver'), 'standard', '{"weekdays": "08:00-18:00", "weekend": "closed", "holidays": "closed"}'::jsonb, '[{"type": "hub_coordinator", "name": "Pacific Hub Manager"}]'::jsonb, '{"flexible_workspace": "Hot-desking protocols"}'::jsonb, 'America/Vancouver', now(), '["remote-hub", "pacific", "collaboration"]', '{"building_class": "Class A", "established": "2020"}'),

-- Temporary Client Site (Example of temporary worksite)
('TechCorp Temp - Ontario Gov', 'Temporary project site at Ontario Government facility for digital transformation project', 'TC-TMP-GOV', 'service', 'temporary', (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'), 'classified', '{"weekdays": "09:00-17:00", "weekend": "closed", "holidays": "closed"}'::jsonb, '[{"type": "project_lead", "name": "Government Project Lead"}]'::jsonb, '{"government_security": "Top Secret clearance required"}'::jsonb, 'America/Toronto', now(), '["temporary", "government", "classified", "project-site"]', '{"building_class": "Government", "project_duration": "18 months", "clearance_required": "Top Secret", "client": "Government of Ontario", "project_end_date": "2025-12-31"}')
;

-- Indexes intentionally omitted in this simplified DDL; add as needed later.
