-- ============================================================================
-- EMPLOYEE DIMENSION - SIMPLIFIED VERSION
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
  employee_number text NOT NULL,
  email text NOT NULL,
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
  biz_id uuid REFERENCES app.d_biz(id) ON DELETE SET NULL,
  hr_position_id uuid REFERENCES app.d_hr(id) ON DELETE SET NULL,
  primary_org_id uuid REFERENCES app.d_org(id) ON DELETE SET NULL,
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

-- Executive Leadership Team
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('James Miller', 'EMP-001', 'james.miller@huronhome.ca', 'James', 'Miller', '2020-01-15', 'active', 'executive', 450000.00, true, '["MBA", "PMP", "Strategic Leadership"]', '["strategic_planning", "board_governance", "mergers_acquisitions", "public_speaking"]', '["en", "fr"]', 'MBA', true, true, NULL, '["executive", "ceo", "leadership", "bilingual"]', '{"linkedin": "james-miller-ceo", "board_positions": 2, "industry_experience": 20, "previous_companies": ["Home Depot Canada", "Loblaws"], "education": "MBA Queens University"}'),
('Sarah Chen', 'EMP-002', 'sarah.chen@huronhome.ca', 'Sarah', 'Chen', '2020-02-01', 'active', 'executive', 380000.00, true, '["CPA", "CFA", "Advanced Finance"]', '["financial_reporting", "investor_relations", "risk_management", "mergers_acquisitions"]', '["en", "zh"]', 'MBA', true, true, NULL, '["executive", "cfo", "finance", "bilingual"]', '{"cpa_designation": "CPA Ontario", "previous_role": "VP Finance Rogers", "specialization": "corporate_finance", "audit_experience": true}'),
('David Kumar', 'EMP-003', 'david.kumar@huronhome.ca', 'David', 'Kumar', '2020-03-15', 'active', 'executive', 370000.00, true, '["P.Eng", "AWS Solutions Architect", "Agile Master"]', '["enterprise_architecture", "digital_transformation", "team_leadership", "vendor_management"]', '["en", "hi"]', 'Masters Engineering', true, true, NULL, '["executive", "cto", "technology", "engineering"]', '{"engineering_license": "PEO", "previous_companies": ["Shopify", "TD Bank"], "specialization": "enterprise_systems", "patents": 3}'),
('Maria Rodriguez', 'EMP-004', 'maria.rodriguez@huronhome.ca', 'Maria', 'Rodriguez', '2020-02-15', 'active', 'executive', 390000.00, true, '["Operations Management", "Lean Six Sigma Black Belt", "Safety Management"]', '["operations_excellence", "process_optimization", "safety_management", "customer_service"]', '["en", "es", "fr"]', 'MBA', true, true, NULL, '["executive", "coo", "operations", "trilingual"]', '{"lean_certification": "ASQ Black Belt", "safety_certifications": ["WSIB", "OHSA"], "previous_role": "VP Operations Canadian Tire", "specialization": "service_operations"}');

-- Senior Vice Presidents
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Robert Thompson', 'EMP-005', 'robert.thompson@huronhome.ca', 'Robert', 'Thompson', '2020-04-01', 'active', 'executive', 320000.00, true, '["Business Administration", "Project Management Professional"]', '["business_development", "strategic_planning", "team_leadership", "client_relations"]', '["en"]', 'MBA', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004'), '["senior-vp", "business-operations", "leadership"]', '{"mba_school": "University of Toronto", "previous_role": "Director Landscaping Services", "specialization": "multi_service_operations", "years_experience": 15}');

-- Vice Presidents and Directors
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Lisa Wang', 'EMP-006', 'lisa.wang@huronhome.ca', 'Lisa', 'Wang', '2020-05-01', 'active', 'management', 280000.00, true, '["CHRP", "Leadership Development", "Change Management"]', '["talent_acquisition", "employee_relations", "organizational_development", "performance_management"]', '["en", "zh"]', 'Masters HR', true, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004'), '["vp", "hr", "talent", "bilingual"]', '{"hrp_designation": "CHRP Ontario", "previous_role": "Director HR Bell Canada", "specialization": "talent_management", "team_size": 25}'),
('Michael O''Connor', 'EMP-007', 'michael.oconnor@huronhome.ca', 'Michael', 'O''Connor', '2020-06-15', 'active', 'management', 270000.00, true, '["CPA", "Financial Planning", "Risk Management"]', '["financial_analysis", "budgeting", "risk_assessment", "reporting"]', '["en"]', 'CPA', true, false, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-002'), '["director", "finance", "analysis"]', '{"cpa_designation": "CPA Ontario", "previous_company": "KPMG", "specialization": "financial_planning", "certifications": ["CRM", "FRM"]}'),
('Jennifer Park', 'EMP-008', 'jennifer.park@huronhome.ca', 'Jennifer', 'Park', '2020-07-01', 'active', 'management', 275000.00, true, '["PMP", "Agile Master", "ITIL"]', '["project_management", "agile_methodologies", "system_integration", "vendor_management"]', '["en", "ko"]', 'Masters CS', true, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003'), '["director", "it", "projects", "bilingual"]', '{"pmp_certification": "PMI", "agile_certifications": ["SAFe", "Scrum Master"], "previous_role": "Senior PM Hydro One", "team_size": 40}');

-- Department Managers - Operations
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, hourly_rate, benefits_eligible, overtime_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Carlos Martinez', 'EMP-009', 'carlos.martinez@huronhome.ca', 'Carlos', 'Martinez', '2021-03-15', 'active', 'management', 180000.00, NULL, true, false, '["Landscape Architecture", "Horticulture", "Project Management"]', '["landscape_design", "project_management", "client_relations", "team_leadership"]', '["en", "es"]', 'Diploma Landscape Architecture', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["manager", "landscaping", "design", "bilingual"]', '{"license": "Ontario Landscape Architect", "specialization": "commercial_landscaping", "years_experience": 12, "certifications": ["ISA Arborist", "OALA"]}'),
('David Kowalski', 'EMP-010', 'david.kowalski@huronhome.ca', 'David', 'Kowalski', '2021-04-01', 'active', 'management', 175000.00, NULL, true, false, '["Snow Equipment Operations", "Fleet Management", "Safety Management"]', '["fleet_management", "operations_planning", "safety_compliance", "emergency_response"]', '["en", "pl"]', 'Diploma Operations Management', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["manager", "snow-removal", "operations", "bilingual"]', '{"specialization": "winter_operations", "fleet_size": 45, "emergency_certified": true, "years_experience": 15}'),
('Amanda Foster', 'EMP-011', 'amanda.foster@huronhome.ca', 'Amanda', 'Foster', '2021-05-15', 'active', 'management', 185000.00, NULL, true, false, '["HVAC Technician", "Gas Fitter", "Refrigeration"]', '["hvac_systems", "energy_efficiency", "technical_troubleshooting", "customer_service"]', '["en"]', 'Diploma HVAC Technology', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["manager", "hvac", "technical"]', '{"licenses": ["G2 Gas Fitter", "ODP Refrigeration"], "specialization": "commercial_hvac", "energy_auditor": true, "years_experience": 10}'),
('Tony Ricci', 'EMP-012', 'tony.ricci@huronhome.ca', 'Tony', 'Ricci', '2021-06-01', 'active', 'management', 170000.00, NULL, true, false, '["Master Plumber", "Backflow Prevention", "Water Systems"]', '["plumbing_systems", "water_management", "code_compliance", "emergency_repairs"]', '["en", "it"]', 'Diploma Plumbing', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["manager", "plumbing", "technical", "bilingual"]', '{"licenses": ["Master Plumber Ontario", "Backflow Prevention"], "specialization": "commercial_plumbing", "emergency_certified": true, "years_experience": 18}'),
('Sarah Kim', 'EMP-013', 'sarah.kim@huronhome.ca', 'Sarah', 'Kim', '2021-08-01', 'active', 'management', 190000.00, NULL, true, false, '["Solar Installation", "Electrical", "Energy Systems"]', '["solar_design", "electrical_systems", "energy_analysis", "project_coordination"]', '["en", "ko"]', 'Electrical Engineering', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["manager", "solar", "electrical", "bilingual"]', '{"licenses": ["Master Electrician", "Solar Installation"], "specialization": "renewable_energy", "years_experience": 8, "certifications": ["NABCEP Solar PV"]}');

-- Field Supervisors and Senior Technicians
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, hourly_rate, benefits_eligible, overtime_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Mark Thompson', 'EMP-014', 'mark.thompson@huronhome.ca', 'Mark', 'Thompson', '2021-09-01', 'active', 'full-time', NULL, 45.00, true, true, '["Landscaping", "Equipment Operation", "Safety Training"]', '["equipment_operation", "crew_leadership", "quality_control", "safety_management"]', '["en"]', 'High School', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-009'), '["supervisor", "landscaping", "field"]', '{"specialization": "landscape_installation", "crew_size": 8, "equipment_certified": true, "years_experience": 7}'),
('Rachel Green', 'EMP-015', 'rachel.green@huronhome.ca', 'Rachel', 'Green', '2021-10-15', 'active', 'full-time', NULL, 42.00, true, true, '["Snow Plow Operation", "Salt Spreading", "Equipment Maintenance"]', '["snow_equipment", "route_planning", "emergency_response", "equipment_maintenance"]', '["en"]', 'College Certificate', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010'), '["supervisor", "snow-removal", "equipment"]', '{"specialization": "commercial_snow_removal", "route_count": 25, "emergency_certified": true, "years_experience": 6}'),
('James Wilson', 'EMP-016', 'james.wilson@huronhome.ca', 'James', 'Wilson', '2022-01-15', 'active', 'full-time', NULL, 48.00, true, true, '["HVAC Technician", "Refrigeration", "Gas Systems"]', '["hvac_repair", "preventive_maintenance", "diagnostic_skills", "customer_service"]', '["en"]', 'Trade Certification', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011'), '["technician", "hvac", "senior"]', '{"licenses": ["G3 Gas Fitter", "HVAC Technician"], "specialization": "commercial_hvac", "years_experience": 12, "emergency_on_call": true}'),
('Maria Santos', 'EMP-017', 'maria.santos@huronhome.ca', 'Maria', 'Santos', '2022-02-01', 'active', 'full-time', NULL, 46.00, true, true, '["Plumbing", "Water Systems", "Drain Cleaning"]', '["plumbing_repair", "water_systems", "drain_maintenance", "emergency_response"]', '["en", "pt"]', 'Trade Certification', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012'), '["technician", "plumbing", "senior", "bilingual"]', '{"licenses": ["Plumber Ontario", "Water Systems"], "specialization": "residential_plumbing", "years_experience": 9, "emergency_on_call": true}'),
('Kevin Chang', 'EMP-018', 'kevin.chang@huronhome.ca', 'Kevin', 'Chang', '2022-03-01', 'active', 'full-time', NULL, 50.00, true, true, '["Electrical", "Solar Installation", "Energy Systems"]', '["electrical_work", "solar_installation", "system_commissioning", "troubleshooting"]', '["en", "zh"]', 'Electrical Technology', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-013'), '["technician", "solar", "electrical", "bilingual"]', '{"licenses": ["Electrician", "Solar Installer"], "specialization": "solar_systems", "years_experience": 6, "safety_certified": true}');

-- Administrative and Support Staff
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, salary_annual, benefits_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Catherine Brooks', 'EMP-019', 'catherine.brooks@huronhome.ca', 'Catherine', 'Brooks', '2021-07-01', 'active', 'full-time', 75000.00, true, '["Project Coordination", "Customer Service"]', '["project_coordination", "scheduling", "customer_communication", "documentation"]', '["en"]', 'Business Administration', true, false, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["coordinator", "projects", "customer-service"]', '{"specialization": "project_coordination", "software_skills": ["MS Project", "CRM"], "years_experience": 5}'),
('Daniel Lee', 'EMP-020', 'daniel.lee@huronhome.ca', 'Daniel', 'Lee', '2021-08-15', 'active', 'full-time', 85000.00, true, '["Financial Analysis", "Accounting"]', '["financial_reporting", "budget_analysis", "accounts_receivable", "cost_accounting"]', '["en", "ko"]', 'Accounting', true, false, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'), '["analyst", "finance", "accounting", "bilingual"]', '{"certifications": ["CPA Candidate"], "software_skills": ["SAP", "Excel", "QuickBooks"], "years_experience": 4}'),
('Sophie Dubois', 'EMP-021', 'sophie.dubois@huronhome.ca', 'Sophie', 'Dubois', '2021-09-01', 'active', 'full-time', 70000.00, true, '["HR Coordination", "Payroll"]', '["payroll_processing", "employee_relations", "recruitment_support", "benefits_administration"]', '["en", "fr"]', 'Human Resources', true, false, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006'), '["coordinator", "hr", "payroll", "bilingual"]', '{"certifications": ["Payroll Compliance"], "software_skills": ["ADP", "HRIS"], "years_experience": 6}'),
('Alex Johnson', 'EMP-022', 'alex.johnson@huronhome.ca', 'Alex', 'Johnson', '2022-01-10', 'active', 'full-time', 95000.00, true, '["System Administration", "Network Security"]', '["system_administration", "network_management", "user_support", "security_protocols"]', '["en"]', 'Computer Science', true, false, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008'), '["administrator", "it", "systems"]', '{"certifications": ["CompTIA Security+", "Microsoft Admin"], "specialization": "infrastructure", "years_experience": 5}');

-- Seasonal and Part-time Workers
INSERT INTO app.d_employee (
  name, employee_number, email, first_name, last_name, hire_date, employment_status,
  employee_type, hourly_rate, benefits_eligible, overtime_eligible, certifications, skills, languages,
  education_level, remote_eligible, travel_required, reports_to_employee_id, tags, attr
) VALUES
('Tyler Murphy', 'EMP-023', 'tyler.murphy@huronhome.ca', 'Tyler', 'Murphy', '2022-04-01', 'active', 'seasonal', 28.00, false, true, '["Landscaping", "Equipment Operation"]', '["landscape_maintenance", "equipment_operation", "customer_interaction"]', '["en"]', 'High School', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014'), '["seasonal", "landscaping", "maintenance"]', '{"season": "spring_summer", "equipment_certified": true, "years_experience": 3, "availability": "full_season"}'),
('Emma Wilson', 'EMP-024', 'emma.wilson@huronhome.ca', 'Emma', 'Wilson', '2021-11-01', 'active', 'seasonal', 32.00, false, true, '["Snow Removal", "Equipment Safety"]', '["snow_clearing", "equipment_operation", "route_efficiency"]', '["en"]', 'High School', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-015'), '["seasonal", "snow-removal", "operations"]', '{"season": "winter", "equipment_certified": true, "years_experience": 2, "emergency_available": true}'),
('Jake Patterson', 'EMP-025', 'jake.patterson@huronhome.ca', 'Jake', 'Patterson', '2022-05-15', 'active', 'part-time', 25.00, false, true, '["General Labor", "Customer Service"]', '["general_labor", "customer_service", "basic_maintenance"]', '["en"]', 'High School', false, true, (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014'), '["part-time", "general", "support"]', '{"availability": "evenings_weekends", "student": true, "years_experience": 1, "flexible_schedule": true}');