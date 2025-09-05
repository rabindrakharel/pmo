-- ============================================================================
-- HR-ORGANIZATION-LOCATION RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Three-way relationship connecting HR positions to organizational units
--   and geographic locations, enabling complex workforce assignment where
--   HR positions may have responsibilities across multiple business units
--   and locations with varying allocation percentages.
--
-- Integration:
--   - Links d_scope_hr to d_scope_org for organizational assignment
--   - Links d_scope_hr to d_scope_location for geographic assignment
--   - Supports matrix organizational structures and remote work
--   - Enables workforce planning and resource allocation analysis

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_hr_org_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  hr_id uuid NOT NULL REFERENCES app.d_scope_hr(id) ON DELETE CASCADE,
  org_id uuid REFERENCES app.d_scope_org(id) ON DELETE SET NULL,
  location_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Assignment details
  assignment_type text DEFAULT 'primary',
  assignment_percentage numeric(5,2) DEFAULT 100.0,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  
  -- Authority and responsibility
  authority_level text DEFAULT 'standard',
  responsibility_scope text,
  reporting_relationship boolean DEFAULT false,
  
  -- Unique constraint for primary assignments
  UNIQUE(hr_id, org_id, location_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- HR Position Organizational and Location Assignments

-- Executive Level Assignments
WITH hr_positions AS (
  SELECT 
    (SELECT id FROM app.d_scope_hr WHERE name = 'Chief Executive Officer') AS ceo_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Chief Financial Officer') AS cfo_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Chief Technology Officer') AS cto_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Chief Operating Officer') AS coo_id
),
organizations AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Huron Home Services') AS corporation_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division') AS biz_ops_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Corporate Services Division') AS corp_services_id
),
locations AS (
  SELECT 
    (SELECT id FROM app.d_scope_location WHERE name = '1250 South Service Rd, Mississauga, ON L5E 1V4') AS headquarters_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Greater Toronto Area') AS gta_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga') AS mississauga_id
)

INSERT INTO app.rel_hr_org_location (
  hr_id, org_id, location_id, assignment_type, assignment_percentage,
  effective_from, authority_level, responsibility_scope, reporting_relationship
)
-- CEO Assignment - Corporate headquarters with enterprise scope
SELECT 
  hr_positions.ceo_id,
  organizations.corporation_id,
  locations.headquarters_id,
  'primary',
  100.0,
  '2020-01-15'::date,
  'ultimate',
  'enterprise_wide',
  false
FROM hr_positions, organizations, locations

UNION ALL

-- CFO Assignment - Corporate services with financial oversight across all divisions
SELECT 
  hr_positions.cfo_id,
  organizations.corp_services_id,
  locations.headquarters_id,
  'primary',
  80.0,
  '2020-02-01'::date,
  'executive',
  'financial_oversight',
  true
FROM hr_positions, organizations, locations

UNION ALL

SELECT 
  hr_positions.cfo_id,
  organizations.biz_ops_id,
  locations.headquarters_id,
  'secondary',
  20.0,
  '2020-02-01'::date,
  'advisory',
  'business_finance_support',
  false
FROM hr_positions, organizations, locations

UNION ALL

-- CTO Assignment - Technology oversight across enterprise
SELECT 
  hr_positions.cto_id,
  organizations.corp_services_id,
  locations.headquarters_id,
  'primary',
  70.0,
  '2020-03-15'::date,
  'executive',
  'technology_leadership',
  true
FROM hr_positions, organizations, locations

UNION ALL

SELECT 
  hr_positions.cto_id,
  organizations.biz_ops_id,
  locations.headquarters_id,
  'secondary',
  30.0,
  '2020-03-15'::date,
  'support',
  'operational_technology',
  false
FROM hr_positions, organizations, locations

UNION ALL

-- COO Assignment - Primary responsibility for business operations with GTA field presence
SELECT 
  hr_positions.coo_id,
  organizations.biz_ops_id,
  locations.headquarters_id,
  'primary',
  60.0,
  '2020-02-15'::date,
  'executive',
  'operational_leadership',
  true
FROM hr_positions, organizations, locations

UNION ALL

SELECT 
  hr_positions.coo_id,
  organizations.biz_ops_id,
  locations.gta_id,
  'field',
  40.0,
  '2020-02-15'::date,
  'operational',
  'field_operations',
  false
FROM hr_positions, organizations, locations;

-- Management Level Assignments
WITH management_hr AS (
  SELECT 
    (SELECT id FROM app.d_scope_hr WHERE name = 'Senior Vice President - Business Operations') AS svp_biz_ops_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Vice President - Landscaping Services') AS vp_landscaping_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Vice President - Technical Services') AS vp_technical_id
),
departments AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Business Operations Division') AS biz_ops_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Landscaping Department') AS landscaping_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'HVAC Services Department') AS hvac_dept_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Plumbing Services Department') AS plumbing_dept_id
),
service_locations AS (
  SELECT 
    (SELECT id FROM app.d_scope_location WHERE name = '1250 South Service Rd, Mississauga, ON L5E 1V4') AS headquarters_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Greater Toronto Area') AS gta_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Toronto') AS toronto_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga') AS mississauga_id
)

INSERT INTO app.rel_hr_org_location (
  hr_id, org_id, location_id, assignment_type, assignment_percentage,
  effective_from, authority_level, responsibility_scope, reporting_relationship
)
-- SVP Business Operations - Multi-departmental oversight with GTA market focus
SELECT 
  management_hr.svp_biz_ops_id,
  departments.biz_ops_id,
  service_locations.headquarters_id,
  'primary',
  50.0,
  '2020-04-01'::date,
  'senior_executive',
  'division_oversight',
  true
FROM management_hr, departments, service_locations

UNION ALL

SELECT 
  management_hr.svp_biz_ops_id,
  departments.biz_ops_id,
  service_locations.gta_id,
  'field',
  50.0,
  '2020-04-01'::date,
  'market_oversight',
  'gta_market_development',
  false
FROM management_hr, departments, service_locations

UNION ALL

-- VP Landscaping - Departmental leadership with multi-location responsibility
SELECT 
  management_hr.vp_landscaping_id,
  departments.landscaping_dept_id,
  service_locations.headquarters_id,
  'primary',
  40.0,
  '2020-05-15'::date,
  'departmental',
  'landscaping_leadership',
  true
FROM management_hr, departments, service_locations

UNION ALL

SELECT 
  management_hr.vp_landscaping_id,
  departments.landscaping_dept_id,
  service_locations.gta_id,
  'operational',
  40.0,
  '2020-05-15'::date,
  'operational',
  'field_operations_oversight',
  false
FROM management_hr, departments, service_locations

UNION ALL

SELECT 
  management_hr.vp_landscaping_id,
  departments.landscaping_dept_id,
  service_locations.toronto_id,
  'market',
  20.0,
  '2020-05-15'::date,
  'market_development',
  'toronto_market_expansion',
  false
FROM management_hr, departments, service_locations

UNION ALL

-- VP Technical Services - Multi-department technical oversight
SELECT 
  management_hr.vp_technical_id,
  departments.hvac_dept_id,
  service_locations.headquarters_id,
  'primary',
  50.0,
  '2020-06-01'::date,
  'departmental',
  'hvac_leadership',
  true
FROM management_hr, departments, service_locations

UNION ALL

SELECT 
  management_hr.vp_technical_id,
  departments.plumbing_dept_id,
  service_locations.headquarters_id,
  'secondary',
  30.0,
  '2020-06-01'::date,
  'departmental',
  'plumbing_oversight',
  true
FROM management_hr, departments, service_locations

UNION ALL

SELECT 
  management_hr.vp_technical_id,
  departments.hvac_dept_id,
  service_locations.gta_id,
  'field',
  20.0,
  '2020-06-01'::date,
  'operational',
  'technical_field_support',
  false
FROM management_hr, departments, service_locations;

-- Director and Manager Level Assignments  
WITH director_hr AS (
  SELECT 
    (SELECT id FROM app.d_scope_hr WHERE name = 'Senior Director - Design & Planning') AS sr_dir_design_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Director - Residential Design') AS dir_residential_id,
    (SELECT id FROM app.d_scope_hr WHERE name = 'Director - Project Implementation') AS dir_implementation_id
),
teams AS (
  SELECT 
    (SELECT id FROM app.d_scope_org WHERE name = 'Residential Landscaping Team') AS residential_team_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Commercial Landscaping Team') AS commercial_team_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Garden Design Squad') AS garden_squad_id,
    (SELECT id FROM app.d_scope_org WHERE name = 'Installation Squad') AS installation_squad_id
),
work_locations AS (
  SELECT 
    (SELECT id FROM app.d_scope_location WHERE name = '1250 South Service Rd, Mississauga, ON L5E 1V4') AS headquarters_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga') AS mississauga_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Oakville') AS oakville_id,
    (SELECT id FROM app.d_scope_location WHERE name = 'Toronto') AS toronto_id
)

INSERT INTO app.rel_hr_org_location (
  hr_id, org_id, location_id, assignment_type, assignment_percentage,
  effective_from, authority_level, responsibility_scope, reporting_relationship
)
-- Senior Director Design & Planning - Cross-team design leadership
SELECT 
  director_hr.sr_dir_design_id,
  teams.residential_team_id,
  work_locations.headquarters_id,
  'primary',
  60.0,
  '2021-01-15'::date,
  'senior_management',
  'design_strategy',
  true
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.sr_dir_design_id,
  teams.garden_squad_id,
  work_locations.headquarters_id,
  'oversight',
  25.0,
  '2021-01-15'::date,
  'creative_oversight',
  'design_standards',
  true
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.sr_dir_design_id,
  teams.residential_team_id,
  work_locations.mississauga_id,
  'client',
  15.0,
  '2021-01-15'::date,
  'client_relations',
  'premium_client_consultation',
  false
FROM director_hr, teams, work_locations

UNION ALL

-- Director Residential Design - Focused residential market leadership
SELECT 
  director_hr.dir_residential_id,
  teams.residential_team_id,
  work_locations.headquarters_id,
  'primary',
  40.0,
  '2021-02-01'::date,
  'departmental',
  'residential_operations',
  true
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.dir_residential_id,
  teams.garden_squad_id,
  work_locations.oakville_id,
  'field',
  35.0,
  '2021-02-01'::date,
  'project_oversight',
  'luxury_residential',
  false
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.dir_residential_id,
  teams.residential_team_id,
  work_locations.toronto_id,
  'market',
  25.0,
  '2021-02-01'::date,
  'business_development',
  'toronto_residential_expansion',
  false
FROM director_hr, teams, work_locations

UNION ALL

-- Director Project Implementation - Cross-location implementation oversight
SELECT 
  director_hr.dir_implementation_id,
  teams.installation_squad_id,
  work_locations.headquarters_id,
  'primary',
  30.0,
  '2021-03-01'::date,
  'operational',
  'implementation_management',
  true
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.dir_implementation_id,
  teams.installation_squad_id,
  work_locations.mississauga_id,
  'field',
  35.0,
  '2021-03-01'::date,
  'field_operations',
  'mississauga_projects',
  false
FROM director_hr, teams, work_locations

UNION ALL

SELECT 
  director_hr.dir_implementation_id,
  teams.commercial_team_id,
  work_locations.toronto_id,
  'support',
  35.0,
  '2021-03-01'::date,
  'project_support',
  'commercial_implementation',
  false
FROM director_hr, teams, work_locations;

-- Indexes removed for simplified import