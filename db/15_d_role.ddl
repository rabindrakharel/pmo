-- ============================================================================
-- ROLE ENTITY (d_role)
-- ============================================================================
--
-- SEMANTICS:
-- • Organizational functions, responsibilities, authority levels across departments
-- • Foundation for permission management, career progression, capability requirements
-- • Categories: executive, management, operational, technical, administrative
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, active_flag=true
-- • UPDATE: Same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now()
-- • LIST: Filter by category, RBAC enforced
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • code, role_code: varchar, text
-- • role_category: text (executive, management, operational, technical, administrative)
-- • system_role_flag, management_role_flag, client_facing_flag, safety_critical_flag: boolean
-- • background_check_required_flag, licensing_required_flag: boolean
--
-- RELATIONSHIPS:
-- • Children: employee (via d_entity_id_map)
-- • RBAC: entity_id_rbac_map
--
-- ============================================================================

CREATE TABLE app.d_role (
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

  -- Role identification
  role_code text NOT NULL,
  role_category text NOT NULL DEFAULT 'operational',

  -- Role attributes (renamed to *_flag pattern)
  system_role_flag boolean NOT NULL DEFAULT false,
  management_role_flag boolean NOT NULL DEFAULT false,
  client_facing_flag boolean NOT NULL DEFAULT false,
  safety_critical_flag boolean NOT NULL DEFAULT false,

  -- Access and permissions (renamed to *_flag pattern)
  background_check_required_flag boolean DEFAULT false,
  bonding_required_flag boolean DEFAULT false,
  licensing_required_flag boolean DEFAULT false,

  -- Organizational context (no direct FK - use entity_id_hierarchy_mapping)
  department_scope text,
  location_scope text,
  reporting_level int DEFAULT 0,

  -- Capability requirements
  required_certifications jsonb DEFAULT '[]'::jsonb,
  required_skills jsonb DEFAULT '[]'::jsonb,
  required_experience_years int DEFAULT 0,
  education_requirements text
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Organizational Role Structure
-- Comprehensive role definitions across all operational areas and hierarchy levels

-- Executive Leadership Roles
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('CEO', 'Chief Executive Officer',
 'Ultimate executive authority responsible for corporate strategy, board relations, and enterprise leadership',
 'CEO', 'executive', false, true, true, false, true, true,
 'enterprise', 0,
 '["MBA", "Executive Leadership", "Board Governance"]',
 '["strategic_planning", "board_governance", "public_speaking", "financial_oversight"]',
 15, 'MBA preferred',
 '{"board_reporting": true, "investor_relations": true, "media_spokesperson": true, "succession_planning": true, "compensation_committee": true}'),

('CFO', 'Chief Financial Officer',
 'Senior executive responsible for financial strategy, reporting, compliance, and treasury management',
 'CFO', 'executive', false, true, true, false, true, true,
 'finance', 1,
 '["CPA", "CFA", "Financial Leadership"]',
 '["financial_reporting", "audit_management", "risk_assessment", "investor_relations"]',
 12, 'CPA designation required',
 '{"regulatory_filing": true, "audit_oversight": true, "treasury_management": true, "risk_management": true, "investor_communications": true}'),

('CTO', 'Chief Technology Officer',
 'Senior executive responsible for technology strategy, digital transformation, and innovation leadership',
 'CTO', 'executive', false, true, false, false, true, false,
 'technology', 1,
 '["P.Eng", "Enterprise Architecture", "Technology Leadership"]',
 '["enterprise_architecture", "digital_strategy", "vendor_management", "innovation_leadership"]',
 12, 'Engineering degree required',
 '{"digital_transformation": true, "vendor_negotiations": true, "patent_oversight": true, "architecture_governance": true, "security_oversight": true}'),

('COO', 'Chief Operating Officer',
 'Senior executive responsible for daily operations, service delivery, and operational excellence',
 'COO', 'executive', false, true, true, true, true, true,
 'operations', 1,
 '["Operations Management", "Safety Leadership", "Service Excellence"]',
 '["operations_management", "service_delivery", "safety_oversight", "performance_optimization"]',
 15, 'MBA or Operations Management',
 '{"operational_oversight": true, "safety_accountability": true, "service_quality": true, "performance_management": true, "crisis_management": true}');

-- Senior Management Roles
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('SVP', 'Senior Vice President',
 'Senior executive responsible for multiple business divisions and strategic business unit management',
 'SVP', 'executive', false, true, true, true, true, true,
 'multi-division', 2,
 '["Business Leadership", "Strategic Management"]',
 '["strategic_planning", "business_development", "team_leadership", "financial_management"]',
 10, 'MBA preferred',
 '{"p_and_l_responsibility": true, "strategic_initiatives": true, "board_reporting": true, "succession_planning": true}'),

('VP-HR', 'Vice President Human Resources',
 'Executive responsible for talent management, organizational development, and employee relations',
 'VP-HR', 'executive', false, true, false, false, true, true,
 'hr', 3,
 '["CHRP", "Leadership Development", "Employment Law"]',
 '["talent_management", "organizational_development", "employee_relations", "compensation_planning"]',
 8, 'Masters in HR preferred',
 '{"employee_count_responsibility": 500, "union_relations": true, "compensation_oversight": true, "succession_planning": true}'),

('DIR-FIN', 'Director of Finance',
 'Senior manager responsible for financial planning, analysis, and reporting functions',
 'DIR-FIN', 'management', false, true, false, false, true, true,
 'finance', 4,
 '["CPA", "Financial Analysis", "Risk Management"]',
 '["financial_planning", "budget_analysis", "reporting", "risk_assessment"]',
 6, 'CPA designation required',
 '{"budget_authority": 50000000, "audit_oversight": true, "investor_reporting": true, "risk_management": true}'),

('DIR-IT', 'Director of Information Technology',
 'Senior manager responsible for technology strategy, systems, and digital transformation',
 'DIR-IT', 'management', false, true, false, false, true, false,
 'it', 4,
 '["PMP", "ITIL", "Enterprise Architecture"]',
 '["system_architecture", "project_management", "vendor_management", "security_oversight"]',
 7, 'Computer Science or Engineering',
 '{"team_size": 40, "budget_authority": 25000000, "security_oversight": true, "vendor_management": true}');

-- Operational Managers
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('MGR-LAND', 'Landscaping Manager',
 'Manager responsible for landscaping operations, design projects, and client service delivery',
 'MGR-LAND', 'operational', false, true, true, true, true, true,
 'landscaping', 5,
 '["Landscape Architecture", "Project Management", "Horticulture"]',
 '["landscape_design", "project_management", "client_relations", "team_leadership"]',
 5, 'Landscape Architecture or related',
 '{"team_size": 25, "project_budget_authority": 2000000, "client_portfolio_value": 15000000, "safety_oversight": true}'),

('MGR-SNOW', 'Snow Removal Manager',
 'Manager responsible for winter operations, fleet management, and emergency response coordination',
 'MGR-SNOW', 'operational', false, true, true, true, true, true,
 'snow-removal', 5,
 '["Fleet Management", "Winter Operations", "Emergency Response"]',
 '["fleet_management", "operations_planning", "emergency_coordination", "safety_management"]',
 5, 'Operations Management or related',
 '{"fleet_size": 45, "response_time_sla": "2_hours", "emergency_on_call": true, "budget_authority": 8000000}'),

('MGR-HVAC', 'HVAC Manager',
 'Manager responsible for HVAC services, technical teams, and energy efficiency programs',
 'MGR-HVAC', 'operational', false, true, true, true, true, true,
 'hvac', 5,
 '["HVAC Technology", "Energy Management", "Technical Leadership"]',
 '["hvac_systems", "energy_efficiency", "technical_management", "customer_service"]',
 6, 'HVAC Technology or Engineering',
 '{"team_size": 18, "service_contracts": 500, "energy_auditor": true, "certification_oversight": true}'),

('MGR-PLUMB', 'Plumbing Manager',
 'Manager responsible for plumbing services, emergency response, and water system maintenance',
 'MGR-PLUMB', 'operational', false, true, true, true, true, true,
 'plumbing', 5,
 '["Master Plumber", "Water Systems", "Emergency Management"]',
 '["plumbing_systems", "emergency_response", "water_management", "code_compliance"]',
 7, 'Master Plumber certification',
 '{"team_size": 15, "emergency_on_call": true, "response_time_sla": "1_hour", "licensing_oversight": true}'),

('MGR-SOLAR', 'Solar Energy Manager',
 'Manager responsible for solar installations, electrical systems, and renewable energy projects',
 'MGR-SOLAR', 'operational', false, true, true, true, true, true,
 'solar', 5,
 '["Electrical Engineering", "Solar Installation", "Project Management"]',
 '["solar_design", "electrical_systems", "project_coordination", "energy_analysis"]',
 4, 'Electrical Engineering or related',
 '{"team_size": 12, "project_pipeline": 200, "electrical_license_req": true, "green_energy_specialist": true}');

-- Field Supervisors and Technical Leads
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('SUP-FIELD', 'Field Supervisor',
 'Supervisory role responsible for field operations, crew management, and quality control',
 'SUP-FIELD', 'operational', false, true, true, true, true, false,
 'operations', 6,
 '["Safety Training", "Leadership", "Quality Control"]',
 '["crew_leadership", "quality_control", "safety_management", "customer_interaction"]',
 3, 'High School plus trade training',
 '{"crew_size": 8, "quality_oversight": true, "safety_responsibility": true, "client_interaction": true}'),

('TECH-SR', 'Senior Technician',
 'Lead technical role with advanced skills, mentoring responsibilities, and complex problem solving',
 'TECH-SR', 'technical', false, false, true, true, true, false,
 'operations', 7,
 '["Advanced Technical", "Mentoring", "Problem Solving"]',
 '["advanced_technical", "mentoring", "troubleshooting", "quality_assurance"]',
 5, 'Trade certification or equivalent',
 '{"mentoring_responsibility": true, "complex_projects": true, "quality_assurance": true, "technical_lead": true}'),

('TECH-FIELD', 'Field Technician',
 'Skilled technician responsible for service delivery, customer interaction, and technical work',
 'TECH-FIELD', 'technical', false, false, true, true, false, false,
 'operations', 8,
 '["Technical Certification", "Customer Service", "Safety"]',
 '["technical_skills", "customer_service", "problem_solving", "equipment_operation"]',
 2, 'Trade certification',
 '{"customer_interaction": true, "service_delivery": true, "technical_work": true, "equipment_operation": true}');

-- Administrative and Support Roles
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('COORD-PROJ', 'Project Coordinator',
 'Coordination role responsible for project scheduling, communication, and administrative support',
 'COORD-PROJ', 'administrative', false, false, true, false, false, false,
 'operations', 7,
 '["Project Coordination", "Communication"]',
 '["project_coordination", "scheduling", "communication", "documentation"]',
 2, 'Business Administration or related',
 '{"project_portfolio": 15, "stakeholder_communication": true, "scheduling_responsibility": true, "documentation_oversight": true}'),

('ANALYST-FIN', 'Financial Analyst',
 'Analytical role responsible for financial analysis, reporting, and budget support',
 'ANALYST-FIN', 'administrative', false, false, false, false, true, true,
 'finance', 7,
 '["Financial Analysis", "Accounting"]',
 '["financial_analysis", "reporting", "budgeting", "data_analysis"]',
 2, 'Accounting or Finance degree',
 '{"budget_analysis": true, "financial_reporting": true, "cost_analysis": true, "variance_reporting": true}'),

('COORD-HR', 'HR Coordinator',
 'Support role responsible for HR administration, payroll, and employee services',
 'COORD-HR', 'administrative', false, false, false, false, true, false,
 'hr', 7,
 '["HR Administration", "Payroll"]',
 '["hr_administration", "payroll", "employee_services", "benefits_administration"]',
 1, 'HR Certificate or related',
 '{"payroll_processing": true, "benefits_administration": true, "employee_services": true, "compliance_support": true}'),

('ADMIN-IT', 'IT Administrator',
 'Technical support role responsible for system administration, user support, and infrastructure',
 'ADMIN-IT', 'technical', false, false, false, false, true, false,
 'it', 7,
 '["System Administration", "Network Security"]',
 '["system_administration", "user_support", "network_management", "security_protocols"]',
 2, 'Computer Science or IT Certificate',
 '{"user_support": true, "system_maintenance": true, "security_administration": true, "infrastructure_management": true}');

-- Operational and Seasonal Roles
INSERT INTO app.d_role (code, name, "descr", role_code, role_category, system_role_flag, management_role_flag,
  client_facing_flag, safety_critical_flag, background_check_required_flag, bonding_required_flag,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, metadata
) VALUES
('SEASONAL', 'Seasonal Worker',
 'Temporary role for seasonal operations including landscaping and snow removal support',
 'SEASONAL', 'operational', false, false, true, true, false, false,
 'operations', 9,
 '["Safety Training", "Equipment Operation"]',
 '["equipment_operation", "customer_interaction", "seasonal_work", "physical_labor"]',
 0, 'High School',
 '{"seasonal_availability": true, "equipment_operation": true, "customer_interaction": true, "physical_demands": true}'),

('PT-SUPPORT', 'Part-time Support',
 'Flexible support role for administrative and operational assistance',
 'PT-SUPPORT', 'administrative', false, false, false, false, false, false,
 'support', 9,
 '["Basic Training"]',
 '["administrative_support", "general_assistance", "flexible_schedule"]',
 0, 'High School',
 '{"flexible_schedule": true, "administrative_support": true, "general_assistance": true, "entry_level": true}');