-- ============================================================================
-- EMPLOYEE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Employee master dimension representing all staff members across the
--   enterprise from executives to front-line workers. Provides foundation
--   for workforce management, performance tracking, compensation management,
--   and organizational reporting across all business operations.
--
-- Employee Categories:
--   - Executive: C-suite and senior leadership positions
--   - Management: Middle management and supervisory roles
--   - Professional: Technical and professional services staff
--   - Skilled: Skilled trades and specialized technicians
--   - General: General labor and support staff
--
-- Integration:
--   - References d_scope_hr for position hierarchy
--   - Links to d_scope_org for departmental assignment
--   - Supports project resource allocation and workforce planning
--   - Enables performance management and career development

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_employee (
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

  -- Employee identification
  employee_number text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  
  -- Personal information
  first_name text NOT NULL,
  last_name text NOT NULL,
  preferred_name text,
  date_of_birth date,
  
  -- Employment details
  hire_date date NOT NULL,
  termination_date date,
  employment_status text NOT NULL DEFAULT 'active',
  employee_type text NOT NULL DEFAULT 'full-time',
  
  -- Organizational assignment
  hr_position_id uuid,
  primary_org_id uuid,
  reports_to_employee_id uuid REFERENCES app.d_employee(id),
  
  -- Compensation and benefits
  salary_annual numeric(10,2),
  hourly_rate numeric(6,2),
  overtime_eligible boolean DEFAULT true,
  benefits_eligible boolean DEFAULT true,
  
  -- Skills and qualifications
  certifications jsonb DEFAULT '[]'::jsonb,
  skills jsonb DEFAULT '[]'::jsonb,
  languages jsonb DEFAULT '["en"]'::jsonb,
  education_level text,
  
  -- Work preferences and attributes
  remote_eligible boolean DEFAULT false,
  travel_required boolean DEFAULT false,
  security_clearance text,
  emergency_contact jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Employee Directory

-- Executive Leadership Team
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, tags, attr
) VALUES
-- CEO
('James Miller', 'EMP-001', 'james.miller@huronhome.ca', 'James', 'Miller', '2020-01-15', 'active', 'executive', 450000.00, true, '["MBA", "PMP", "Strategic Leadership"]', '["strategic_planning", "board_governance", "mergers_acquisitions", "public_speaking"]', '["en", "fr"]', 'MBA', true, true, 
'["executive", "ceo", "leadership", "bilingual"]', 
'{"linkedin": "james-miller-ceo", "board_positions": 2, "industry_experience": 20, "previous_companies": ["Home Depot Canada", "Loblaws"], "education": "MBA Queens University"}'),

-- CFO
('Sarah Chen', 'EMP-002', 'sarah.chen@huronhome.ca', 'Sarah', 'Chen', '2020-02-01', 'active', 'executive', 380000.00, true, '["CPA", "CFA", "Advanced Finance"]', '["financial_reporting", "investor_relations", "risk_management", "mergers_acquisitions"]', '["en", "zh"]', 'MBA', true, true,
'["executive", "cfo", "finance", "bilingual"]',
'{"cpa_designation": "CPA Ontario", "previous_role": "VP Finance Rogers", "specialization": "corporate_finance", "audit_experience": true}'),

-- CTO  
('David Kumar', 'EMP-003', 'david.kumar@huronhome.ca', 'David', 'Kumar', '2020-03-15', 'active', 'executive', 370000.00, true, '["P.Eng", "AWS Solutions Architect", "Agile Master"]', '["enterprise_architecture", "digital_transformation", "team_leadership", "vendor_management"]', '["en", "hi"]', 'Masters Engineering', true, true,
'["executive", "cto", "technology", "engineering"]',
'{"engineering_license": "PEO", "previous_companies": ["Shopify", "TD Bank"], "specialization": "enterprise_systems", "patents": 3}'),

-- COO
('Maria Rodriguez', 'EMP-004', 'maria.rodriguez@huronhome.ca', 'Maria', 'Rodriguez', '2020-02-15', 'active', 'executive', 390000.00, true, '["Operations Management", "Lean Six Sigma Black Belt", "Safety Management"]', '["operations_excellence", "process_optimization", "safety_management", "customer_service"]', '["en", "es", "fr"]', 'MBA', true, true,
'["executive", "coo", "operations", "trilingual"]',
'{"lean_certification": "ASQ Black Belt", "safety_certifications": ["WSIB", "OHSA"], "previous_role": "VP Operations Canadian Tire", "specialization": "service_operations"});

-- Senior Vice Presidents
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Robert Thompson', 'EMP-005', 'robert.thompson@huronhome.ca', 'Robert', 'Thompson', '2020-04-01', 'active', 'executive', 320000.00, true, '["Business Administration", "Project Management Professional"]', '["business_development", "strategic_planning", "team_leadership", "client_relations"]', '["en"]', 'MBA', false, true,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004'),
'["senior-vp", "business-operations", "leadership"]',
'{"mba_school": "University of Toronto", "previous_role": "Director Landscaping Services", "specialization": "multi_service_operations", "years_experience": 15}');

-- Vice Presidents
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Jennifer Walsh', 'EMP-006', 'jennifer.walsh@huronhome.ca', 'Jennifer', 'Walsh', '2020-05-15', 'active', 'management', 240000.00, true, '["Landscape Architecture", "Certified Grounds Manager", "Horticulture Specialist"]', '["landscape_design", "project_management", "team_leadership", "client_consultation"]', '["en", "fr"]', 'Masters Landscape Architecture', true, true,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'),
'["vp", "landscaping", "design", "bilingual"]',
'{"professional_license": "OALA", "design_awards": 5, "specialization": "residential_commercial", "sustainability_focus": true}'),

('Michael Patterson', 'EMP-007', 'michael.patterson@huronhome.ca', 'Michael', 'Patterson', '2020-06-01', 'active', 'management', 235000.00, true, '["Mechanical Engineering", "HVAC Excellence", "Gas Technician License"]', '["technical_leadership", "system_design", "safety_management", "customer_service"]', '["en"]', 'Bachelor Engineering', false, true,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'),
'["vp", "technical-services", "hvac", "engineering"]',
'{"engineering_license": "PEO", "gas_license": "TSSA G2", "certifications": ["HVAC Excellence", "Refrigeration"], "specialization": "commercial_systems"});

-- Assistant Vice Presidents
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Lisa Chang', 'EMP-008', 'lisa.chang@huronhome.ca', 'Lisa', 'Chang', '2020-07-15', 'active', 'management', 190000.00, true, '["Business Administration", "Customer Relations Management"]', '["client_development", "market_analysis", "team_management", "sales_strategy"]', '["en", "zh"]', 'MBA', true, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006'),
'["avp", "residential", "client-focused", "bilingual"]',
'{"sales_experience": 12, "client_portfolio_value": 8000000, "customer_satisfaction": 4.7, "specialization": "residential_market"}'),

('Paul Martineau', 'EMP-009', 'paul.martineau@huronhome.ca', 'Paul', 'Martineau', '2020-08-01', 'active', 'management', 195000.00, true, '["Civil Engineering", "Construction Management", "Municipal Contracts"]', '["large_scale_projects", "municipal_relations", "contract_management", "team_leadership"]', '["en", "fr"]', 'Bachelor Engineering', false, true,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006'),
'["avp", "commercial", "municipal", "bilingual"]',
'{"engineering_license": "PEO", "municipal_experience": 10, "contract_values": 15000000, "specialization": "commercial_municipal"});

-- Directors and Senior Staff
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Amanda Foster', 'EMP-010', 'amanda.foster@huronhome.ca', 'Amanda', 'Foster', '2021-01-15', 'active', 'professional', 145000.00, true, '["Landscape Design", "Sustainable Design", "AutoCAD Professional"]', '["design_leadership", "creative_direction", "client_consultation", "sustainability"]', '["en"]', 'Bachelor Landscape Architecture', true, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008'),
'["director", "design", "sustainability", "creative"]',
'{"design_portfolio": 200, "sustainability_certifications": ["LEED", "Sustainable Sites"], "awards": 3, "specialization": "eco_design"}'),

('Tom Richardson', 'EMP-011', 'tom.richardson@huronhome.ca', 'Tom', 'Richardson', '2021-02-01', 'active', 'professional', 135000.00, true, '["Construction Management", "Safety Coordinator", "Equipment Operation"]', '["project_execution", "team_coordination", "safety_management", "quality_control"]', '["en"]', 'College Diploma', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010'),
'["director", "implementation", "safety", "execution"]',
'{"safety_record": "zero_incidents_3_years", "projects_completed": 150, "team_size": 25, "specialization": "installation_operations"}'),

('Kevin O''Brien', 'EMP-012', 'kevin.obrien@huronhome.ca', 'Kevin', 'O''Brien', '2021-03-15', 'active', 'skilled', 85000.00, true, '["Red Seal Electrician", "Solar Installation", "HVAC Technician"]', '["electrical_systems", "solar_installation", "troubleshooting", "customer_service"]', '["en"]', 'Trade Certification', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
'["technician", "electrical", "solar", "certified"]',
'{"red_seal": true, "solar_certifications": ["NABCEP", "CSA"], "years_experience": 12, "specialization": "residential_solar"}'),

('Sandra Mitchell', 'EMP-013', 'sandra.mitchell@huronhome.ca', 'Sandra', 'Mitchell', '2021-04-01', 'active', 'skilled', 78000.00, true, '["Licensed Plumber", "Gas Fitter", "Backflow Prevention"]', '["plumbing_systems", "emergency_repair", "customer_service", "diagnostics"]', '["en", "fr"]', 'Trade Certification', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
'["technician", "plumbing", "licensed", "bilingual"]',
'{"plumbing_license": "Ontario 306A", "gas_fitting": "G2", "emergency_response": true, "specialization": "residential_commercial"});

-- Skilled Trades and Field Staff
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, hourly_rate, overtime_eligible, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Carlos Santos', 'EMP-014', 'carlos.santos@huronhome.ca', 'Carlos', 'Santos', '2021-05-15', 'active', 'full-time', 28.50, true, true, '["Landscape Installation", "Equipment Operation", "Safety Training"]', '["plant_installation", "hardscaping", "equipment_operation", "team_work"]', '["en", "es", "pt"]', 'High School', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011'),
'["installer", "landscaping", "multilingual", "equipment"]',
'{"years_experience": 8, "equipment_certified": ["skid_steer", "excavator", "crane"], "safety_record": "excellent", "specialization": "hardscape_installation"}'),

('Patricia Lee', 'EMP-015', 'patricia.lee@huronhome.ca', 'Patricia', 'Lee', '2021-06-01', 'active', 'full-time', 32.00, true, true, '["Horticulture Certificate", "Plant Health Care", "Pesticide Application"]', '["plant_care", "pest_management", "landscape_maintenance", "client_education"]', '["en", "ko"]', 'College Certificate', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010'),
'["horticulturist", "plant-care", "specialist", "bilingual"]',
'{"horticulture_certification": "Ontario College", "pesticide_license": "Class 12", "plant_specialties": ["native_species", "perennials"], "client_education": true}'),

('Mike Wilson', 'EMP-016', 'mike.wilson@huronhome.ca', 'Mike', 'Wilson', '2021-07-15', 'active', 'full-time', 35.00, true, true, '["Snow Plow Operation", "Equipment Maintenance", "Commercial Driver"]', '["snow_removal", "equipment_operation", "route_optimization", "emergency_response"]', '["en"]', 'High School', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011'),
'["operator", "snow-removal", "driver", "emergency"]',
'{"cdl_class": "A", "snow_plow_certified": true, "emergency_response": true, "winter_experience": 10}'),

('Rachel Kim', 'EMP-017', 'rachel.kim@huronhome.ca', 'Rachel', 'Kim', '2022-01-10', 'active', 'full-time', 24.00, true, true, '["Customer Service", "Administrative Assistant", "Office Management"]', '["customer_support", "scheduling", "data_entry", "office_coordination"]', '["en", "ko"]', 'College Diploma', true, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008'),
'["admin", "customer-service", "scheduling", "bilingual"]',
'{"customer_satisfaction": 4.8, "scheduling_software": "ServiceTitan", "languages_support": ["english", "korean"], "office_skills": "advanced"}'),

('John MacDonald', 'EMP-018', 'john.macdonald@huronhome.ca', 'John', 'MacDonald', '2022-02-15', 'active', 'part-time', 26.00, true, false, '["Equipment Maintenance", "Fleet Management", "Preventive Maintenance"]', '["equipment_repair", "diagnostics", "preventive_maintenance", "inventory_management"]', '["en"]', 'Trade School', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011'),
'["maintenance", "equipment", "fleet", "diagnostics"]',
'{"maintenance_specialties": ["hydraulics", "engines", "electrical"], "fleet_size": 85, "uptime_achievement": 0.97, "inventory_management": true});

-- Seasonal and Contract Staff
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, hourly_rate, overtime_eligible, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Emma Johnson', 'EMP-019', 'emma.johnson@huronhome.ca', 'Emma', 'Johnson', '2022-04-01', 'active', 'seasonal', 22.00, true, false, '["Landscape Maintenance", "Safety Training"]', '["garden_maintenance", "planting", "pruning", "cleanup"]', '["en"]', 'High School', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-015'),
'["seasonal", "landscaping", "maintenance", "gardening"]',
'{"season_focus": "spring_summer_fall", "garden_experience": 3, "reliability_score": "high", "specialization": "residential_maintenance"}'),

('Alex Dubois', 'EMP-020', 'alex.dubois@huronhome.ca', 'Alex', 'Dubois', '2022-11-15', 'active', 'seasonal', 30.00, true, false, '["Snow Removal", "Equipment Operation", "Commercial Driver"]', '["snow_clearing", "salting", "equipment_operation", "emergency_response"]', '["en", "fr"]', 'High School', false, false,
(SELECT id FROM app.d_employee WHERE employee_number = 'EMP-016'),
'["seasonal", "snow-removal", "bilingual", "emergency"]',
'{"season_focus": "winter", "cdl_endorsement": true, "emergency_certified": true, "years_snow_experience": 6}');

-- Indexes removed for simplified import