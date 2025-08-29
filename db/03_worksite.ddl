-- ============================================================================
-- WORKSITE SCOPE HIERARCHY (Physical Service Sites and Operational Facilities)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The worksite scope hierarchy represents the physical operational facilities
-- and service sites where business activities are conducted. It provides the
-- foundational infrastructure context for project execution, resource deployment,
-- and operational management across distributed physical locations.
--
-- ARCHITECTURAL PURPOSE:
-- The d_scope_worksite table serves as the physical infrastructure backbone that enables:
--
-- • PHYSICAL OPERATIONS: Management of physical sites where work is performed
-- • RESOURCE ALLOCATION: Equipment, materials, and personnel assignment to specific sites
-- • OPERATIONAL COORDINATION: Site-specific operational procedures and workflows
-- • SAFETY MANAGEMENT: Site safety protocols, emergency procedures, and compliance
-- • ASSET MANAGEMENT: Physical asset tracking and maintenance across worksites
-- • SERVICE DELIVERY: Client service delivery and project execution locations
--
-- WORKSITE CLASSIFICATION DESIGN:
-- Worksites are classified by their operational purpose and characteristics:
--
-- Type 1 (Corporate Office): Headquarters, regional offices, administrative centers
-- Type 2 (Development Center): R&D facilities, software development centers, labs
-- Type 3 (Service Delivery): Client sites, field offices, temporary project locations
-- Type 4 (Data Center): IT infrastructure, server farms, cloud facilities
-- Type 5 (Warehouse/Logistics): Storage facilities, distribution centers, supply depots
-- Type 6 (Manufacturing): Production facilities, assembly plants, workshops
--
-- GEOGRAPHIC AND BUSINESS INTEGRATION:
-- Worksites bridge geographic and business organizational dimensions:
-- - Each worksite is tied to a specific geographic location (d_scope_location)
-- - Each worksite can be owned/operated by specific business units (d_scope_business)
-- - Projects are executed at specific worksites with local resource access
-- - Employees are assigned to worksites for operational coordination
--
-- OPERATIONAL INTEGRATION:
-- Worksite scopes integrate with operational activities:
-- - Projects reference worksites for execution location and resource access
-- - Tasks inherit worksite context for local operational requirements
-- - Equipment and materials are allocated to specific worksites
-- - Safety and compliance requirements are site-specific
--
-- MULTI-DIMENSIONAL COORDINATION:
-- Worksite hierarchy enables cross-functional operations:
--
-- • LOCATION-BUSINESS MATRIX: Worksites link geographic and business dimensions
-- • RESOURCE OPTIMIZATION: Shared resources between nearby worksites
-- • OPERATIONAL EFFICIENCY: Site-specific procedures and local expertise
-- • COMPLIANCE MANAGEMENT: Site-specific regulatory and safety requirements
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. MULTI-SITE PROJECT EXECUTION:
--    - Platform Modernization project spans Toronto HQ and Montreal Development Center
--    - Resources allocated across multiple worksites with local expertise
--    - Site-specific compliance and security requirements managed
--    - Equipment and infrastructure shared between nearby worksites
--
-- 2. CLIENT SERVICE DELIVERY:
--    - Client Portal project deployed at client worksite in Ottawa
--    - Temporary project team established at client location
--    - Local regulations and client security protocols enforced
--    - Remote coordination with Toronto development team
--
-- 3. DISASTER RECOVERY AND BUSINESS CONTINUITY:
--    - Primary operations at Toronto HQ disrupted
--    - Operations transferred to backup worksite in Mississauga
--    - Resources and personnel relocated based on worksite capabilities
--    - Service delivery continued with minimal disruption
--
-- OPERATIONAL CHARACTERISTICS:
-- Each worksite maintains specific operational attributes:
-- - Physical infrastructure and capacity specifications
-- - Security clearance levels and access control requirements
-- - Available equipment, tools, and technological capabilities
-- - Local regulatory compliance and safety protocols
-- - Emergency procedures and disaster recovery plans
--
-- SCALABILITY AND FLEXIBILITY:
-- Worksite design supports operational growth:
-- - Dynamic worksite establishment for temporary projects
-- - Flexible capacity allocation based on project requirements
-- - Integration with external partner and contractor facilities
-- - Support for remote and hybrid work arrangements

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

CREATE TABLE app.d_scope_worksite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  worksite_code text,
  worksite_type text DEFAULT 'office',
  operational_status text DEFAULT 'active',

  -- Location and Business relationships
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  biz_id uuid,

  -- Operational details
  security_level text DEFAULT 'standard',
  access_hours jsonb DEFAULT '{"weekdays": "08:00-18:00", "weekend": "closed"}'::jsonb,
  emergency_contacts jsonb DEFAULT '[]'::jsonb,
  safety_protocols jsonb DEFAULT '{}'::jsonb,

  -- Geospatial and operational
  geom geometry(Geometry, 4326),
  timezone text DEFAULT 'America/Toronto',

  -- Standard audit fields
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
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
