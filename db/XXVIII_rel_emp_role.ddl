-- ============================================================================
-- XXV. EMPLOYEE-ROLE RELATIONSHIPS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Employee-Role relationship table managing the assignment of roles to
--   employees with temporal tracking and audit capabilities for compliance
--   and security management. Supports many-to-many relationships between
--   employees and roles with historical tracking.
--
-- Entity Type: rel_emp_role
-- Entity Classification: Relationship Table (many-to-many mapping)
--
-- Primary Relationships:
--   - employee (via entity_id_hierarchy_mapping)
--   - role (via entity_id_hierarchy_mapping)
--
-- Relationship Characteristics:
--   - Many-to-many: Employees can have multiple roles
--   - Many-to-many: Roles can be assigned to multiple employees
--   - Temporal: Supports from_ts/to_ts for role history
--   - Auditable: Complete audit trail for compliance reviews
--   - Versioned: Support for role transitions and assignments
--
-- New Design Integration:
--   - Uses entity_id_hierarchy_mapping for employee and role references
--   - No direct foreign keys (follows new standard)
--   - Supports RBAC via entity_id_rbac_map table
--   - Uses common field structure with temporal tracking
--   - Includes metadata jsonb field for assignment details
--
-- Legacy Design Elements Retained:
--   - Temporal tracking with from_ts/to_ts
--   - Active flag for current assignments
--   - Audit trail capabilities
--   - Support for role transitions and history
--
-- Business Rules:
--   - Employees can hold multiple active roles simultaneously
--   - Role assignments must have valid date ranges
--   - Historical role assignments are preserved for audit purposes
--   - Role changes require proper approval workflows
--   - Emergency role assignments can bypass normal approval
--
-- UI Navigation Model:
--   - Accessible from Employee Detail Page as "Roles" tab
--   - Accessible from Role Detail Page as "Employees" tab
--   - Supports inline editing for role assignments
--   - Historical view available for audit purposes
--   - Bulk assignment capabilities for efficient management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version int DEFAULT 1,

  -- Relationship identifiers (use entity_id_hierarchy_mapping, not direct FKs)
  emp_id uuid NOT NULL,
  role_id uuid NOT NULL,

  -- Assignment metadata
  assignment_type text DEFAULT 'primary',
  assignment_reason text,
  approved_by_emp_id uuid,
  effective_date date DEFAULT CURRENT_DATE,
  expiry_date date,

  -- Assignment context
  assignment_priority int DEFAULT 1,
  is_primary_role boolean DEFAULT false,
  is_acting_role boolean DEFAULT false,
  is_temporary_assignment boolean DEFAULT false,

  -- Metadata for assignment details
  metadata jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Employee-Role Assignments
-- Comprehensive role assignments linking employees to their functional roles
-- Based on existing employee and role data from previous DDL files

-- Executive Leadership Role Assignments
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Executive appointment', '2020-01-15', true,
  '{"appointment_level": "board_approved", "compensation_committee_approved": true, "background_check_completed": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'james.miller@huronhome.ca' AND r.role_code = 'CEO';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Executive appointment', '2020-02-01', true,
  '{"appointment_level": "board_approved", "cpa_verified": true, "financial_background_verified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'sarah.chen@huronhome.ca' AND r.role_code = 'CFO';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Executive appointment', '2020-03-15', true,
  '{"appointment_level": "board_approved", "security_clearance": "completed", "technical_credentials_verified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'david.kumar@huronhome.ca' AND r.role_code = 'CTO';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Executive appointment', '2020-02-15', true,
  '{"appointment_level": "board_approved", "operations_experience_verified": true, "safety_certifications_current": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'maria.rodriguez@huronhome.ca' AND r.role_code = 'COO';

-- Senior Management Role Assignments
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Senior management promotion', '2020-04-01', true,
  '{"promotion_approved": true, "leadership_development_completed": true, "multi_division_experience": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'robert.thompson@huronhome.ca' AND r.role_code = 'SVP';

-- Vice Presidents and Directors
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'VP appointment', '2020-05-01', true,
  '{"hr_leadership_certified": true, "employment_law_trained": true, "organizational_development_specialist": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'lisa.wang@huronhome.ca' AND r.role_code = 'VP-HR';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Director appointment', '2020-06-15', true,
  '{"cpa_designation_verified": true, "financial_analysis_certified": true, "audit_experience_confirmed": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'michael.oconnor@huronhome.ca' AND r.role_code = 'DIR-FIN';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Director appointment', '2020-07-01', true,
  '{"pmp_certified": true, "agile_methodologies_certified": true, "vendor_management_experience": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'jennifer.park@huronhome.ca' AND r.role_code = 'DIR-IT';

-- Department Managers - Operations
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Department manager promotion', '2021-03-15', true,
  '{"landscape_architecture_licensed": true, "project_management_certified": true, "client_relations_trained": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'carlos.martinez@huronhome.ca' AND r.role_code = 'MGR-LAND';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Department manager promotion', '2021-04-01', true,
  '{"fleet_management_certified": true, "winter_operations_specialist": true, "emergency_response_trained": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'david.kowalski@huronhome.ca' AND r.role_code = 'MGR-SNOW';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Department manager promotion', '2021-05-15', true,
  '{"hvac_technician_licensed": true, "gas_fitter_certified": true, "energy_efficiency_specialist": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'amanda.foster@huronhome.ca' AND r.role_code = 'MGR-HVAC';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Department manager promotion', '2021-06-01', true,
  '{"master_plumber_licensed": true, "backflow_prevention_certified": true, "emergency_response_qualified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'tony.ricci@huronhome.ca' AND r.role_code = 'MGR-PLUMB';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Department manager promotion', '2021-08-01', true,
  '{"solar_installation_certified": true, "electrical_licensed": true, "renewable_energy_specialist": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'sarah.kim@huronhome.ca' AND r.role_code = 'MGR-SOLAR';

-- Field Supervisors and Senior Technicians
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Supervisory promotion', '2021-09-01', true,
  '{"leadership_training_completed": true, "safety_management_certified": true, "crew_coordination_experienced": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'mark.thompson@huronhome.ca' AND r.role_code = 'SUP-FIELD';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Supervisory promotion', '2021-10-15', true,
  '{"snow_equipment_certified": true, "route_planning_experienced": true, "emergency_response_qualified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'rachel.green@huronhome.ca' AND r.role_code = 'SUP-FIELD';

-- Senior Technicians with dual roles (both senior and field technician)
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Senior technician promotion', '2022-01-15', true,
  '{"advanced_hvac_certified": true, "mentoring_qualified": true, "complex_systems_specialist": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'james.wilson@huronhome.ca' AND r.role_code = 'TECH-SR';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'secondary', 'Field service capability', '2022-01-15', false,
  '{"customer_service_trained": true, "field_operations_qualified": true, "on_call_available": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'james.wilson@huronhome.ca' AND r.role_code = 'TECH-FIELD';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Senior technician promotion', '2022-02-01', true,
  '{"advanced_plumbing_certified": true, "water_systems_specialist": true, "emergency_services_qualified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'maria.santos@huronhome.ca' AND r.role_code = 'TECH-SR';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'secondary', 'Field service capability', '2022-02-01', false,
  '{"residential_specialist": true, "customer_relations_experienced": true, "bilingual_capability": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'maria.santos@huronhome.ca' AND r.role_code = 'TECH-FIELD';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Senior technician promotion', '2022-03-01', true,
  '{"electrical_licensed": true, "solar_specialist": true, "system_commissioning_qualified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'kevin.chang@huronhome.ca' AND r.role_code = 'TECH-SR';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'secondary', 'Field service capability', '2022-03-01', false,
  '{"electrical_installation": true, "troubleshooting_expert": true, "safety_certified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'kevin.chang@huronhome.ca' AND r.role_code = 'TECH-FIELD';

-- Administrative and Support Staff
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Administrative assignment', '2021-07-01', true,
  '{"project_coordination_trained": true, "customer_service_experienced": true, "scheduling_specialist": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'catherine.brooks@huronhome.ca' AND r.role_code = 'COORD-PROJ';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'Financial analyst assignment', '2021-08-15', true,
  '{"financial_analysis_certified": true, "accounting_qualified", "budget_analysis_experienced": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'daniel.lee@huronhome.ca' AND r.role_code = 'ANALYST-FIN';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'HR coordinator assignment', '2021-09-01', true,
  '{"payroll_certified": true, "hr_administration_qualified": true, "bilingual_capability": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'sophie.dubois@huronhome.ca' AND r.role_code = 'COORD-HR';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'primary', 'IT administrator assignment', '2022-01-10', true,
  '{"system_administration_certified": true, "network_security_qualified": true, "user_support_experienced": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'alex.johnson@huronhome.ca' AND r.role_code = 'ADMIN-IT';

-- Seasonal and Part-time Workers
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, is_temporary_assignment, metadata)
SELECT
  e.id, r.id, 'seasonal', 'Seasonal employment', '2022-04-01', true, true,
  '{"seasonal_period": "spring_summer", "equipment_operation_certified": true, "customer_interaction_trained": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'tyler.murphy@huronhome.ca' AND r.role_code = 'SEASONAL';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, is_temporary_assignment, metadata)
SELECT
  e.id, r.id, 'seasonal', 'Winter seasonal employment', '2021-11-01', true, true,
  '{"seasonal_period": "winter", "snow_equipment_certified": true, "emergency_availability": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'emma.wilson@huronhome.ca' AND r.role_code = 'SEASONAL';

INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, assignment_reason, effective_date, is_primary_role, metadata)
SELECT
  e.id, r.id, 'part-time', 'Part-time support assignment', '2022-05-15', true,
  '{"flexible_schedule": true, "student_employee": true, "general_support_qualified": true}'
FROM app.d_employee e, app.d_role r
WHERE e.email = 'jake.patterson@huronhome.ca' AND r.role_code = 'PT-SUPPORT';

-- James Miller Landscaping Manager Role Assignment (for Fall 2024 Campaign)
INSERT INTO app.rel_emp_role (
  emp_id,
  role_id,
  assignment_type,
  assignment_reason,
  effective_date,
  is_primary_role,
  is_acting_role,
  metadata
)
SELECT
  e.id,
  r.id,
  'secondary',
  'Direct oversight of Fall 2024 Landscaping Campaign - CEO acting as Landscaping Manager for strategic project',
  '2024-08-01',
  false,
  true,
  '{
    "project_specific": true,
    "project_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f",
    "project_name": "Fall 2024 Landscaping Campaign",
    "assignment_duration": "campaign_duration",
    "strategic_oversight": true,
    "direct_client_engagement": true,
    "team_leadership": true,
    "budget_authority": true,
    "reason": "CEO providing direct leadership for high-priority seasonal campaign"
  }'::jsonb
FROM app.d_employee e, app.d_role r
WHERE e.email = 'james.miller@huronhome.ca'
  AND r.role_code = 'MGR-LAND';