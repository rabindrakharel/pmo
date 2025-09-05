-- ============================================================================
-- PROJECT-CLIENT RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between projects and clients, supporting complex
--   project structures where multiple clients may be involved in a single
--   project, or clients may have multiple concurrent projects across different
--   service lines and time periods.
--
-- Integration:
--   - Links d_scope_project to d_client for project ownership
--   - Supports multi-client projects and client project portfolios
--   - Enables client relationship tracking across project lifecycle
--   - Facilitates revenue attribution and client value analysis

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_project_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  project_id uuid NOT NULL REFERENCES app.d_scope_project(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES app.d_client(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Client role in project
  client_role text DEFAULT 'primary',
  relationship_type text DEFAULT 'direct',
  billing_responsibility text DEFAULT 'primary',
  
  -- Financial and contractual
  contract_value numeric(12,2),
  payment_terms text DEFAULT 'net-30',
  billing_percentage numeric(5,2) DEFAULT 100.00,
  
  -- Communication and coordination
  primary_contact boolean DEFAULT false,
  decision_authority boolean DEFAULT false,
  communication_frequency text DEFAULT 'regular',
  
  -- Unique constraint for primary client relationships
  UNIQUE(project_id, client_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Project-Client Relationships for Huron Home Services

-- Service Delivery Project-Client Relationships
WITH projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'FALL-2025-LAND') AS fall_landscaping_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'WIN-2025-SNOW') AS winter_snow_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'WHR-2025-PLUMB') AS water_heater_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'SPR-2025-GARD') AS spring_garden_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'SOL-2025-EXP') AS solar_expansion_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'HVAC-2025-MAINT') AS hvac_maintenance_id
),
clients AS (
  SELECT 
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-001') AS thompson_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-002') AS miller_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-003') AS chen_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-004') AS rosedale_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-RES-005') AS exec_community_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-001') AS square_one_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-002') AS meadowvale_bp_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-COM-003') AS toronto_tower_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-PM-001') AS rpm_canada_id,
    (SELECT id FROM app.d_client WHERE client_number = 'CL-PM-002') AS cam_assets_id
)

INSERT INTO app.rel_project_client (
  project_id, client_id, client_role, relationship_type, billing_responsibility,
  contract_value, payment_terms, billing_percentage, primary_contact,
  decision_authority, communication_frequency
)
-- Fall 2025 Landscaping Campaign Client Relationships
SELECT 
  projects.fall_landscaping_id,
  clients.thompson_id,
  'primary',
  'direct',
  'primary',
  25000.00,
  'net-15',
  100.00,
  true,
  true,
  'weekly'
FROM projects, clients

UNION ALL

SELECT 
  projects.fall_landscaping_id,
  clients.miller_id,
  'primary',
  'direct',
  'primary',
  35000.00,
  'net-30',
  100.00,
  true,
  true,
  'bi-weekly'
FROM projects, clients

UNION ALL

SELECT 
  projects.fall_landscaping_id,
  clients.chen_id,
  'primary',
  'direct',
  'primary',
  40000.00,
  'net-15',
  100.00,
  true,
  true,
  'as-needed'
FROM projects, clients

UNION ALL

SELECT 
  projects.fall_landscaping_id,
  clients.square_one_id,
  'primary',
  'direct',
  'primary',
  120000.00,
  'net-45',
  100.00,
  true,
  true,
  'daily'
FROM projects, clients

UNION ALL

SELECT 
  projects.fall_landscaping_id,
  clients.exec_community_id,
  'primary',
  'contract',
  'primary',
  80000.00,
  'net-30',
  100.00,
  true,
  false,
  'weekly'
FROM projects, clients

-- Winter 2025 Snow Operations Client Relationships
UNION ALL

SELECT 
  projects.winter_snow_id,
  clients.square_one_id,
  'primary',
  'direct',
  'primary',
  180000.00,
  'net-45',
  100.00,
  true,
  true,
  'daily'
FROM projects, clients

UNION ALL

SELECT 
  projects.winter_snow_id,
  clients.meadowvale_bp_id,
  'primary',
  'direct',
  'primary',
  95000.00,
  'net-30',
  100.00,
  true,
  true,
  'weather-dependent'
FROM projects, clients

UNION ALL

SELECT 
  projects.winter_snow_id,
  clients.toronto_tower_id,
  'primary',
  'direct',
  'primary',
  150000.00,
  'net-60',
  100.00,
  true,
  true,
  'weather-dependent'
FROM projects, clients

UNION ALL

SELECT 
  projects.winter_snow_id,
  clients.rpm_canada_id,
  'primary',
  'contract',
  'primary',
  85000.00,
  'net-30',
  100.00,
  true,
  false,
  'weather-dependent'
FROM projects, clients

-- Water Heater Replacement Program Client Relationships  
UNION ALL

SELECT 
  projects.water_heater_id,
  clients.thompson_id,
  'secondary',
  'direct',
  'secondary',
  8500.00,
  'net-15',
  100.00,
  false,
  true,
  'project-specific'
FROM projects, clients

UNION ALL

SELECT 
  projects.water_heater_id,
  clients.miller_id,
  'secondary',
  'direct',
  'secondary',
  12000.00,
  'net-30',
  100.00,
  false,
  true,
  'project-specific'
FROM projects, clients

UNION ALL

SELECT 
  projects.water_heater_id,
  clients.exec_community_id,
  'primary',
  'contract',
  'primary',
  45000.00,
  'net-30',
  100.00,
  true,
  false,
  'monthly'
FROM projects, clients

-- Spring 2025 Garden Design Client Relationships
UNION ALL

SELECT 
  projects.spring_garden_id,
  clients.chen_id,
  'primary',
  'direct',
  'primary',
  60000.00,
  'net-15',
  100.00,
  true,
  true,
  'weekly'
FROM projects, clients

UNION ALL

SELECT 
  projects.spring_garden_id,
  clients.rosedale_id,
  'primary',
  'direct',
  'primary',
  85000.00,
  'net-15',
  100.00,
  true,
  true,
  'bi-weekly'
FROM projects, clients

-- Solar Panel Installation Expansion Client Relationships
UNION ALL

SELECT 
  projects.solar_expansion_id,
  clients.thompson_id,
  'pilot',
  'direct',
  'primary',
  25000.00,
  'net-15',
  100.00,
  true,
  true,
  'project-intensive'
FROM projects, clients

UNION ALL

SELECT 
  projects.solar_expansion_id,
  clients.chen_id,
  'primary',
  'direct',
  'primary',
  35000.00,
  'net-15',
  100.00,
  true,
  true,
  'project-intensive'
FROM projects, clients

-- HVAC Maintenance Contracts 2025 Client Relationships
UNION ALL

SELECT 
  projects.hvac_maintenance_id,
  clients.toronto_tower_id,
  'primary',
  'direct',
  'primary',
  180000.00,
  'net-60',
  100.00,
  true,
  true,
  'monthly'
FROM projects, clients

UNION ALL

SELECT 
  projects.hvac_maintenance_id,
  clients.meadowvale_bp_id,
  'primary',
  'direct',
  'primary',
  65000.00,
  'net-30',
  100.00,
  true,
  true,
  'quarterly'
FROM projects, clients

UNION ALL

SELECT 
  projects.hvac_maintenance_id,
  clients.cam_assets_id,
  'primary',
  'contract',
  'primary',
  220000.00,
  'net-45',
  100.00,
  true,
  false,
  'monthly'
FROM projects, clients

UNION ALL

SELECT 
  projects.hvac_maintenance_id,
  clients.rpm_canada_id,
  'secondary',
  'contract',
  'secondary',
  45000.00,
  'net-30',
  100.00,
  false,
  false,
  'as-needed'
FROM projects, clients;

-- Infrastructure Project-Client Relationships
WITH infra_projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'ERP-2025-P1') AS erp_project_id,
    (SELECT id FROM app.d_scope_project WHERE project_code = 'FLEET-2025-UPG') AS fleet_project_id
),
internal_clients AS (
  SELECT 
    -- Internal projects typically have the corporation itself as the client
    -- or may not have traditional client relationships
    NULL as internal_client_id
)

INSERT INTO app.rel_project_client (
  project_id, client_id, client_role, relationship_type, billing_responsibility,
  contract_value, payment_terms, billing_percentage, primary_contact,
  decision_authority, communication_frequency
)
-- Note: Internal infrastructure projects typically don't have external client relationships
-- They would be managed through internal stakeholder relationships
SELECT 
  infra_projects.erp_project_id,
  NULL, -- Internal project
  'internal',
  'stakeholder',
  'internal',
  NULL,
  'internal',
  0.00,
  false,
  false,
  'project-meetings'
FROM infra_projects
WHERE 1=0; -- Commented out as these are internal projects

-- Strategic Initiative Project-Client Relationships  
WITH strategic_projects AS (
  SELECT 
    (SELECT id FROM app.d_scope_project WHERE project_code = 'MKT-EXP-HAM-2025') AS hamilton_expansion_id
)

INSERT INTO app.rel_project_client (
  project_id, client_id, client_role, relationship_type, billing_responsibility,
  contract_value, payment_terms, billing_percentage, primary_contact,
  decision_authority, communication_frequency
)
-- Market expansion projects focus on acquiring new clients
-- Initial relationships may be prospect/pipeline clients
SELECT 
  strategic_projects.hamilton_expansion_id,
  NULL, -- Prospect clients to be added as relationships develop
  'prospect',
  'pipeline',
  'future',
  NULL,
  'tbd',
  0.00,
  false,
  false,
  'business-development'
FROM strategic_projects
WHERE 1=0; -- Commented out until prospect clients are defined

-- Indexes removed for simplified import