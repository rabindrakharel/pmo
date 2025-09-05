-- ============================================================================
-- ROLE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Role definition dimension representing functional roles and responsibilities
--   across the enterprise. Provides foundation for role-based access control,
--   permission management, and organizational capability mapping. Supports
--   both operational roles and system access roles.
--
-- Role Categories:
--   - Executive: C-suite and senior leadership roles
--   - Management: Middle management and supervisory roles  
--   - Professional: Technical and professional service roles
--   - Operational: Front-line operational and service delivery roles
--   - Support: Administrative and support function roles
--   - System: Technical system access and integration roles
--
-- Integration:
--   - Links to d_employee through relationship tables
--   - Supports permission and scope assignment
--   - Enables role-based security and access control
--   - Facilitates organizational capability planning

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_role (
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

  -- Role identification
  role_code text UNIQUE NOT NULL,
  role_category text NOT NULL DEFAULT 'operational',
  
  -- Role attributes
  is_system_role boolean NOT NULL DEFAULT false,
  is_management_role boolean NOT NULL DEFAULT false,
  is_client_facing boolean NOT NULL DEFAULT false,
  is_safety_critical boolean NOT NULL DEFAULT false,
  
  -- Access and permissions
  requires_background_check boolean DEFAULT false,
  requires_bonding boolean DEFAULT false,
  requires_licensing boolean DEFAULT false,
  
  -- Organizational context
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

-- Huron Home Services Role Catalog

-- Executive Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role, 
  is_client_facing, is_safety_critical, requires_background_check, requires_bonding,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, tags, attr
) VALUES
('Chief Executive Officer', 'Ultimate executive authority responsible for corporate strategy, board relations, and enterprise leadership', 'CEO', 'executive', false, true, true, false, true, true, 'enterprise', 0, 
'["MBA", "Executive Leadership", "Board Governance"]', '["strategic_planning", "board_governance", "public_speaking", "financial_oversight"]', 15, 'MBA preferred',
'["executive", "ceo", "board-reporting", "ultimate-authority"]',
'{"board_reporting": true, "investor_relations": true, "media_spokesperson": true, "succession_planning": true, "compensation_committee": true}'),

('Chief Financial Officer', 'Senior executive responsible for financial strategy, reporting, compliance, and treasury management', 'CFO', 'executive', false, true, true, false, true, true, 'finance', 1,
'["CPA", "CFA", "Financial Leadership"]', '["financial_reporting", "audit_management", "risk_assessment", "investor_relations"]', 12, 'CPA designation required',
'["executive", "cfo", "financial", "compliance"]',
'{"regulatory_filing": true, "audit_oversight": true, "treasury_management": true, "risk_management": true, "investor_communications": true}'),

('Chief Technology Officer', 'Senior executive responsible for technology strategy, digital transformation, and innovation leadership', 'CTO', 'executive', false, true, false, false, true, false, 'technology', 1,
'["P.Eng", "Enterprise Architecture", "Technology Leadership"]', '["enterprise_architecture", "digital_strategy", "vendor_management", "innovation_leadership"]', 12, 'Engineering degree required',
'["executive", "cto", "technology", "innovation"]',
'{"digital_transformation": true, "vendor_negotiations": true, "patent_oversight": true, "architecture_governance": true, "security_oversight": true}'),

('Chief Operating Officer', 'Senior executive responsible for daily operations, service delivery, and operational excellence', 'COO', 'executive', false, true, true, true, true, true, 'operations', 1,
'["Operations Management", "Safety Leadership", "Service Excellence"]', '["operations_management", "service_delivery", "safety_oversight", "performance_optimization"]', 15, 'MBA or Operations Management',
'["executive", "coo", "operations", "safety"]',
'{"operational_oversight": true, "safety_accountability": true, "service_quality": true, "performance_management": true, "crisis_management": true}');

-- Senior Management Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role,
  is_client_facing, is_safety_critical, requires_background_check, department_scope,
  reporting_level, required_certifications, required_skills, required_experience_years,
  education_requirements, tags, attr
) VALUES
('Senior Vice President', 'Senior executive responsible for multiple business divisions and strategic business unit management', 'SVP', 'executive', false, true, true, true, true, 'multi-division', 2,
'["Business Leadership", "Strategic Management"]', '["strategic_planning", "business_development", "team_leadership", "financial_management"]', 10, 'MBA preferred',
'["senior-vp", "multi-division", "strategic", "p&l-responsibility"]',
'{"p_and_l_responsibility": true, "strategic_initiatives": true, "board_reporting": true, "succession_planning": true}'),

('Vice President', 'Executive responsible for major business function or service line with full operational authority', 'VP', 'management', false, true, true, true, true, 'department', 3,
'["Business Management", "Industry Expertise"]', '["department_management", "strategic_execution", "client_relations", "team_development"]', 8, 'University degree required',
'["vp", "department", "operational", "client-facing"]',
'{"department_authority": true, "budget_responsibility": true, "client_relationships": true, "performance_accountability": true}');

-- Professional and Technical Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role,
  is_client_facing, is_safety_critical, requires_background_check, requires_licensing,
  department_scope, reporting_level, required_certifications, required_skills,
  required_experience_years, education_requirements, tags, attr
) VALUES
('Landscape Architect', 'Professional responsible for landscape design, site planning, and project design leadership', 'LARCH', 'professional', false, false, true, false, true, true, 'landscaping', 4,
'["Landscape Architecture License", "OALA Registration"]', '["design_software", "site_analysis", "plant_knowledge", "client_consultation"]', 5, 'Bachelor Landscape Architecture',
'["professional", "design", "licensed", "creative"]',
'{"professional_license": "OALA", "design_responsibility": true, "code_compliance": true, "client_presentations": true}'),

('Project Manager', 'Professional responsible for project planning, execution, and delivery across all service lines', 'PM', 'professional', false, true, true, false, true, false, 'all-departments', 4,
'["PMP", "Project Management"]', '["project_planning", "resource_management", "client_communication", "risk_management"]', 5, 'University degree preferred',
'["professional", "project-management", "client-facing", "cross-functional"]',
'{"project_authority": true, "budget_management": true, "client_interface": true, "quality_assurance": true}'),

('HVAC Technician', 'Skilled technician responsible for HVAC system installation, maintenance, and emergency repair', 'HVAC-TECH', 'operational', false, false, true, true, true, true, 'hvac', 5,
'["HVAC Certification", "Gas License G2", "Refrigeration License"]', '["system_diagnostics", "installation", "repair", "customer_service"]', 3, 'Trade certification required',
'["technician", "hvac", "licensed", "safety-critical"]',
'{"trade_certification": true, "gas_handling": true, "emergency_response": true, "safety_protocols": true}'),

('Licensed Plumber', 'Skilled tradesperson responsible for plumbing system installation, repair, and maintenance', 'PLUMBER', 'operational', false, false, true, true, true, true, 'plumbing', 5,
'["Plumbing License 306A", "Backflow Prevention"]', '["plumbing_systems", "diagnostics", "installation", "emergency_repair"]', 3, 'Plumbing trade certification',
'["technician", "plumbing", "licensed", "emergency"]',
'{"plumbing_license": "306A", "backflow_certified": true, "emergency_services": true, "code_compliance": true}');

-- Operational and Field Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role,
  is_client_facing, is_safety_critical, requires_background_check, department_scope,
  reporting_level, required_certifications, required_skills, required_experience_years,
  education_requirements, tags, attr
) VALUES
('Landscape Installation Specialist', 'Skilled worker responsible for landscape installation, hardscaping, and site construction', 'INSTALL-SPEC', 'operational', false, false, true, true, true, 'landscaping', 6,
'["Equipment Operation", "Safety Training"]', '["plant_installation", "hardscaping", "equipment_operation", "site_preparation"]', 2, 'High school or equivalent',
'["installer", "landscaping", "equipment", "safety"]',
'{"equipment_certified": true, "safety_training": true, "client_interaction": true, "quality_focus": true}'),

('Snow Removal Operator', 'Specialized operator responsible for snow clearing, de-icing, and winter maintenance operations', 'SNOW-OP', 'operational', false, false, false, true, true, 'snow-removal', 6,
'["Commercial Driver License", "Snow Plow Certification"]', '["snow_equipment", "route_navigation", "emergency_response", "weather_assessment"]', 2, 'High school and CDL',
'["operator", "snow-removal", "cdl", "emergency"]',
'{"cdl_required": true, "winter_operations": true, "emergency_response": true, "equipment_maintenance": true}'),

('Equipment Maintenance Technician', 'Technician responsible for fleet maintenance, preventive maintenance, and equipment repair', 'EQUIP-TECH', 'operational', false, false, false, true, true, 'maintenance', 6,
'["Equipment Maintenance", "Hydraulics", "Electrical Systems"]', '["mechanical_repair", "diagnostics", "preventive_maintenance", "inventory_management"]', 3, 'Trade school or equivalent',
'["maintenance", "technician", "equipment", "diagnostics"]',
'{"mechanical_expertise": true, "diagnostic_tools": true, "preventive_maintenance": true, "parts_management": true}'),

('Customer Service Representative', 'Professional responsible for customer support, scheduling, and client communication', 'CSR', 'support', false, false, true, false, false, 'customer-service', 6,
'["Customer Service", "CRM Software"]', '["customer_communication", "scheduling", "problem_resolution", "data_entry"]', 1, 'High school diploma',
'["customer-service", "scheduling", "communication", "administrative"]',
'{"customer_interface": true, "scheduling_software": true, "problem_solving": true, "multi_channel_support": true});

-- Supervisory and Team Lead Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role,
  is_client_facing, is_safety_critical, requires_background_check, department_scope,
  reporting_level, required_certifications, required_skills, required_experience_years,
  education_requirements, tags, attr
) VALUES
('Crew Supervisor', 'Field supervisor responsible for crew leadership, work quality, and safety compliance', 'CREW-SUP', 'management', false, true, true, true, true, 'all-field', 5,
'["Supervision", "Safety Management", "Quality Control"]', '["team_leadership", "quality_control", "safety_management", "client_interaction"]', 5, 'Trade background required',
'["supervisor", "field", "safety", "quality"]',
'{"team_leadership": true, "safety_authority": true, "quality_responsibility": true, "client_interface": true}'),

('Department Manager', 'Middle manager responsible for departmental operations, staff management, and performance', 'DEPT-MGR', 'management', false, true, true, true, true, 'department-specific', 4,
'["Management Training", "Performance Management"]', '["staff_management", "performance_evaluation", "budget_management", "strategic_execution"]', 5, 'University degree preferred',
'["manager", "departmental", "staff", "performance"]',
'{"staff_authority": true, "budget_responsibility": true, "performance_management": true, "strategic_execution": true}');

-- System and Administrative Roles
INSERT INTO app.d_role (
  name, "descr", role_code, role_category, is_system_role, is_management_role,
  is_client_facing, is_safety_critical, requires_background_check, department_scope,
  reporting_level, required_certifications, required_skills, required_experience_years,
  education_requirements, tags, attr
) VALUES
('System Administrator', 'Technical role responsible for system maintenance, user management, and technical support', 'SYSADMIN', 'system', true, false, false, false, true, 'it', 5,
'["System Administration", "Network Management", "Security"]', '["system_administration", "user_management", "security_management", "troubleshooting"]', 3, 'Technical certification',
'["system", "administrator", "technical", "security"]',
'{"system_access": true, "user_provisioning": true, "security_management": true, "backup_responsibility": true}'),

('API Integration Specialist', 'Technical role responsible for API development, integration management, and data flow', 'API-SPEC', 'system', true, false, false, false, true, 'it', 6,
'["API Development", "Integration Platforms", "Data Management"]', '["api_development", "integration_design", "data_mapping", "troubleshooting"]', 2, 'Technical degree or certification',
'["system", "api", "integration", "technical"]',
'{"api_access": true, "integration_authority": true, "data_management": true, "system_integration": true}'),

('Financial Analyst', 'Professional responsible for financial analysis, reporting, and business intelligence', 'FIN-ANALYST', 'support', false, false, false, false, true, 'finance', 5,
'["Financial Analysis", "Business Intelligence", "Excel Advanced"]', '["financial_modeling", "data_analysis", "reporting", "business_intelligence"]', 2, 'Finance or business degree',
'["analyst", "financial", "reporting", "business-intelligence"]',
'{"financial_data": true, "reporting_tools": true, "analysis_responsibility": true, "confidential_data": true});

-- Indexes removed for simplified import