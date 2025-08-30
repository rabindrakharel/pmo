-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Employee table serves as central identity and authentication repository for all 
-- human resources, consolidating personal identity, authentication credentials, 
-- and demographic information for HR and access control operations.
--
-- Key Features:
-- • Identity management and authentication (JWT, email-based login)
-- • Profile management with Canadian privacy compliance (PIPEDA)
-- • Role-based access control foundation
-- • HR integration and employee lifecycle management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_employee (
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
  -- Employee-specific fields
  addr text,
  email text UNIQUE,
  password_hash text,
  phone text,
  mobile text,
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  lang text DEFAULT 'en',
  birth_date date,
  emp_code text,
  hire_date date,
  status text DEFAULT 'active',
  employment_type text DEFAULT 'full_time', --contingent, intern, part_time, full_time, contractor, co-op
  work_mode text DEFAULT 'office',
  security_clearance text DEFAULT 'internal',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Huron Home Services Employee Hierarchy (All Employment Types and Departments)
INSERT INTO app.d_employee (
  name, "descr", addr, email, password_hash, phone, mobile, emergency_contact,
  lang, birth_date, emp_code, hire_date, status, employment_type, work_mode,
  security_clearance, skills, certifications, education, labels, attr
) VALUES

-- =========== MANAGEMENT & EXECUTIVE TEAM ===========
-- CEO/President
('James Miller', 'Chief Executive Officer and Founder of Huron Home Services - Leading company vision and strategic growth', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'james.miller@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-1001', '+1-905-555-1002', '{"name": "Patricia Miller", "relationship": "spouse", "phone": "+1-905-555-1003"}'::jsonb,
 'en', '1975-03-15', 'CEO001', '2018-04-15', 'active', 'full_time', 'office', 'internal', '["leadership", "strategic_planning", "business_development", "home_services_industry", "entrepreneurship"]'::jsonb, '["MBA", "Ontario Business License", "Home Services Contractor License"]'::jsonb, '[{"degree": "MBA", "institution": "Ivey Business School", "year": 2005}, {"degree": "B.Comm", "institution": "University of Toronto", "year": 1998}]'::jsonb, '["ceo", "founder", "executive"]'::jsonb, '{"founded_company": "2018", "previous_experience": "20 years home services", "board_positions": ["Ontario Home Services Association"]}'),

-- Operations Director
('Sarah Chen', 'Director of Operations - Overseeing daily operations across all service divisions and managing field teams', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'sarah.chen@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-2001', '+1-905-555-2002', '{"name": "Michael Chen", "relationship": "brother", "phone": "+1-905-555-2003"}'::jsonb,
 'en', '1982-07-22', 'DIR001', '2018-06-01', 'active', 'full_time', 'hybrid', 'internal', '["operations_management", "team_leadership", "process_optimization", "quality_control", "scheduling"]'::jsonb, '["Project Management Professional (PMP)", "Lean Six Sigma Black Belt"]'::jsonb, '[{"degree": "B.Eng Industrial Engineering", "institution": "University of Waterloo", "year": 2005}]'::jsonb, '["director", "operations", "management"]'::jsonb, '{"departments_managed": ["landscaping", "plumbing", "hvac", "electrical"], "team_size": 85}'),

-- =========== LANDSCAPING DEPARTMENT ===========
-- Manager
('Robert Thompson', 'Landscaping Department Manager - Leading comprehensive landscaping services and seasonal operations', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'robert.thompson@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-3001', '+1-905-555-3002', '{"name": "Linda Thompson", "relationship": "spouse", "phone": "+1-905-555-3003"}'::jsonb,
 'en', '1978-04-12', 'LAND001', '2018-05-15', 'active', 'full_time', 'field', 'internal', '["landscaping", "horticulture", "team_management", "seasonal_planning", "equipment_management"]'::jsonb, '["Certified Landscape Professional", "Pesticide License", "Tree Care Specialist"]'::jsonb, '[{"degree": "Diploma Horticulture", "institution": "Niagara College", "year": 2002}]'::jsonb, '["manager", "landscaping", "field"]'::jsonb, '{"department": "landscaping", "team_size": 28, "seasonal_staff": 45}'),

-- Full-time Landscaping Team Lead
('Maria Santos', 'Senior Landscaping Team Lead - Supervising daily landscaping operations and training junior staff', '45 Mapleview Dr, Mississauga, ON L5A 2K8', 'maria.santos@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-3101', '+1-905-555-3102', '{"name": "Carlos Santos", "relationship": "spouse", "phone": "+1-905-555-3103"}'::jsonb,
 'en', '1985-09-18', 'LAND002', '2019-03-01', 'active', 'full_time', 'field', 'internal', '["landscape_design", "irrigation_systems", "tree_care", "lawn_maintenance", "team_leadership"]'::jsonb, '["Landscape Ontario Certified", "Irrigation Association Certified", "First Aid/CPR"]'::jsonb, '[{"degree": "Certificate Landscape Design", "institution": "Sheridan College", "year": 2008}]'::jsonb, '["team_lead", "landscaping", "senior"]'::jsonb, '{"specialization": "irrigation_design", "crew_size": 8, "years_experience": 15}'),

-- Full-time Landscaper
('David Kumar', 'Experienced Landscaper - Specializing in garden design, lawn care, and seasonal maintenance services', '78 Creditview Rd, Mississauga, ON L5M 4Z5', 'david.kumar@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-3201', '+1-905-555-3202', '{"name": "Priya Kumar", "relationship": "spouse", "phone": "+1-905-555-3203"}'::jsonb,
 'en', '1990-12-05', 'LAND003', '2020-04-15', 'active', 'full_time', 'field', 'internal', '["lawn_care", "garden_maintenance", "mulching", "pruning", "hardscaping"]'::jsonb, '["Landscape Ontario Member", "Safe Pesticide Application"]'::jsonb, '[{"degree": "High School Diploma", "institution": "Turner Fenton Secondary School", "year": 2009}]'::jsonb, '["landscaper", "full_time", "experienced"]'::jsonb, '{"route": "mississauga_central", "vehicle_assigned": "truck_003", "years_experience": 8}'),

-- Part-time Seasonal Landscaper
('Jennifer Walsh', 'Part-time Seasonal Landscaper - Supporting peak season landscaping operations and maintenance', '22 Erin Mills Pkwy, Mississauga, ON L5M 4Z2', 'jennifer.walsh@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-3301', '+1-905-555-3302', '{"name": "Brian Walsh", "relationship": "brother", "phone": "+1-905-555-3303"}'::jsonb,
 'en', '1995-06-30', 'LAND004', '2023-04-01', 'active', 'part_time', 'field', 'internal', '["lawn_mowing", "garden_cleanup", "planting", "basic_maintenance"]'::jsonb, '["First Aid/CPR"]'::jsonb, '[{"degree": "College Certificate Recreation", "institution": "Humber College", "year": 2018}]'::jsonb, '["landscaper", "part_time", "seasonal"]'::jsonb, '{"season": "April_to_October", "hours_per_week": 24, "weekend_availability": true}'),

-- Contractor Landscaper
('Green Earth Landscaping Inc.', 'Independent Landscaping Contractor - Specialized services for large residential and commercial projects', 'Various client locations', 'contact@greenearth.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-3401', '+1-905-555-3402', '{"name": "Tom Green", "relationship": "owner", "phone": "+1-905-555-3403"}'::jsonb,
 'en', '1970-08-20', 'CONT001', '2019-05-01', 'active', 'contractor', 'field', 'internal', '["commercial_landscaping", "hardscaping", "large_projects", "equipment_operation"]'::jsonb, '["WSIB Coverage", "Liability Insurance", "Commercial Landscaping License"]'::jsonb, '[{"certification": "Landscape Contractor License", "year": 1995}]'::jsonb, '["contractor", "landscaping", "commercial"]'::jsonb, '{"company_size": 12, "specialization": "commercial_hardscaping", "contract_rate": "$85/hour"}'),

-- =========== PLUMBING DEPARTMENT ===========
-- Manager
('Michael O''Brien', 'Master Plumber and Department Manager - Leading all plumbing services including emergency response', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'michael.obrien@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-4001', '+1-905-555-4002', '{"name": "Catherine O''Brien", "relationship": "spouse", "phone": "+1-905-555-4003"}'::jsonb,
 'en', '1972-11-08', 'PLUM001', '2018-05-15', 'active', 'full_time', 'field', 'internal', '["master_plumbing", "emergency_services", "team_management", "code_compliance", "water_systems"]'::jsonb, '["Master Plumber License", "Gas Fitter License", "Backflow Prevention"]'::jsonb, '[{"apprenticeship": "Plumbing Apprenticeship", "institution": "Plumbers Union Local 46", "year": 1995}]'::jsonb, '["manager", "master_plumber", "licensed"]'::jsonb, '{"license_number": "MP-5547-ON", "team_size": 22, "emergency_on_call": true}'),

-- Full-time Journeyman Plumber
('Andrew Peterson', 'Licensed Journeyman Plumber - Residential and commercial plumbing installations and repairs', '156 Burnhamthorpe Rd W, Mississauga, ON L5B 3C2', 'andrew.peterson@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-4101', '+1-905-555-4102', '{"name": "Sarah Peterson", "relationship": "spouse", "phone": "+1-905-555-4103"}'::jsonb,
 'en', '1988-02-25', 'PLUM002', '2020-01-15', 'active', 'full_time', 'field', 'internal', '["residential_plumbing", "pipe_fitting", "fixture_installation", "drain_cleaning", "water_heater_service"]'::jsonb, '["Journeyman Plumber License", "Gas Fitter Class B", "TSSA Certified"]'::jsonb, '[{"apprenticeship": "Plumbing Apprenticeship", "institution": "Mohawk College", "year": 2012}]'::jsonb, '["journeyman", "plumber", "licensed"]'::jsonb, '{"license_number": "JP-8822-ON", "route": "mississauga_west", "van_number": "PLUM-05"}'),

-- Part-time Plumbing Apprentice
('Kevin Patel', 'Third-year Plumbing Apprentice - Learning advanced plumbing techniques while supporting senior plumbers', '89 Hurontario St, Mississauga, ON L5G 3H5', 'kevin.patel@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-4201', '+1-905-555-4202', '{"name": "Raj Patel", "relationship": "father", "phone": "+1-905-555-4203"}'::jsonb,
 'en', '1998-07-14', 'PLUM003', '2022-09-01', 'active', 'part_time', 'field', 'internal', '["apprentice_plumbing", "pipe_cutting", "basic_repairs", "tool_maintenance", "learning"]'::jsonb, '["Apprentice Registration", "First Aid/CPR", "WHMIS Certification"]'::jsonb, '[{"program": "Plumbing Apprenticeship Year 3", "institution": "George Brown College", "expected": "2025"}]'::jsonb, '["apprentice", "plumber", "part_time"]'::jsonb, '{"apprentice_year": 3, "school_schedule": "block_release", "mentor": "Andrew Peterson"}'),

-- Contractor Plumber
('Emergency Plumbing Solutions Ltd.', 'Licensed Emergency Plumbing Contractor - 24/7 emergency plumbing services and complex installations', 'Various emergency locations', 'dispatch@emergencyplumb.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-4301', '+1-905-555-4302', '{"name": "Emergency Dispatch", "phone": "+1-905-555-4303"}'::jsonb,
 'en', '1965-03-12', 'CONT002', '2019-01-01', 'active', 'contractor', 'field', 'internal', '["emergency_plumbing", "24_7_service", "complex_installations", "commercial_plumbing"]'::jsonb, '["Master Plumber License", "WSIB Coverage", "Liability Insurance $2M", "Emergency Response Certified"]'::jsonb, '[{"certification": "Master Plumber", "year": 1990}]'::jsonb, '["contractor", "emergency", "licensed"]'::jsonb, '{"response_time": "1_hour", "rate": "$125/hour", "after_hours_rate": "$175/hour", "team_size": 5}'),

-- =========== HVAC DEPARTMENT ===========
-- HVAC Technician
('Lisa Rodriguez', 'Licensed HVAC Technician - Installation and maintenance of heating, ventilation, and air conditioning systems', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'lisa.rodriguez@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-5001', '+1-905-555-5002', '{"name": "Carlos Rodriguez", "relationship": "spouse", "phone": "+1-905-555-5003"}'::jsonb,
 'en', '1986-05-16', 'HVAC001', '2019-08-01', 'active', 'full_time', 'field', 'internal', '["hvac_installation", "furnace_maintenance", "ac_repair", "duct_cleaning", "energy_efficiency"]'::jsonb, '["TSSA Gas Technician", "HRAI Certified", "Refrigerant Handling", "Energy Auditor"]'::jsonb, '[{"diploma": "HVAC Technology", "institution": "Centennial College", "year": 2008}]'::jsonb, '["hvac", "technician", "licensed"]'::jsonb, '{"gas_license": "GT2-5523-ON", "service_area": "gta_west", "specialization": "high_efficiency_systems"}'),

-- =========== ELECTRICAL DEPARTMENT ===========
-- Licensed Electrician
('John MacLeod', 'Licensed Electrician - Residential electrical installations, repairs, and safety inspections', '85 Bentley Ave, Toronto, ON M6N 2W7', 'john.macleod@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-6001', '+1-416-555-6002', '{"name": "Helen MacLeod", "relationship": "spouse", "phone": "+1-416-555-6003"}'::jsonb,
 'en', '1980-09-22', 'ELEC001', '2019-03-01', 'active', 'full_time', 'field', 'internal', '["residential_electrical", "panel_upgrades", "wiring", "code_compliance", "safety_inspections"]'::jsonb, '["Master Electrician License", "ESA Certification", "Code Update Training 2024"]'::jsonb, '[{"apprenticeship": "Electrical Apprenticeship", "institution": "IBEW Local 353", "year": 2005}]'::jsonb, '["electrician", "master", "licensed"]'::jsonb, '{"esa_license": "ME-7845-ON", "service_area": "toronto_west", "insurance_coverage": "$1M"}'),

-- =========== ADMINISTRATION DEPARTMENT ===========
-- Customer Service Representative
('Emma Foster', 'Customer Service Representative - Handling customer inquiries, booking appointments, and service coordination', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'emma.foster@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-7001', '+1-905-555-7002', '{"name": "Mark Foster", "relationship": "spouse", "phone": "+1-905-555-7003"}'::jsonb,
 'en', '1992-10-11', 'CUST001', '2020-06-15', 'active', 'full_time', 'office', 'internal', '["customer_service", "appointment_scheduling", "billing_support", "complaint_resolution", "multilingual"]'::jsonb, '["Customer Service Excellence", "Conflict Resolution", "Bilingual Certification"]'::jsonb, '[{"diploma": "Business Administration", "institution": "Sheridan College", "year": 2015}]'::jsonb, '["customer_service", "office", "bilingual"]'::jsonb, '{"languages": ["English", "French"], "shift": "day", "customer_satisfaction_score": 4.8}'),

-- Part-time Administrative Assistant
('Nicole Chang', 'Part-time Administrative Assistant - Supporting office operations, filing, and data entry', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'nicole.chang@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-7101', '+1-905-555-7102', '{"name": "Student Services", "phone": "+1-905-555-7103"}'::jsonb,
 'en', '2002-01-28', 'ADMIN001', '2023-09-01', 'active', 'part_time', 'office', 'internal', '["administrative_support", "data_entry", "filing", "phone_support", "microsoft_office"]'::jsonb, '["Microsoft Office Specialist", "Data Entry Certification"]'::jsonb, '[{"degree": "Business Studies (in progress)", "institution": "University of Toronto Mississauga", "expected": "2025"}]'::jsonb, '["admin", "part_time", "student"]'::jsonb, '{"school_schedule": "flexible", "hours_per_week": 20, "availability": "evenings_weekends"}'),

-- =========== SEASONAL SNOW REMOVAL ===========
-- Snow Removal Operator (Contingent/Seasonal)
('Frank Kowalski', 'Seasonal Snow Removal Equipment Operator - Operating plows and salt spreaders during winter months', '15 Matheson Blvd W, Mississauga, ON L5R 3L8', 'frank.kowalski@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-8001', '+1-905-555-8002', '{"name": "Anna Kowalski", "relationship": "spouse", "phone": "+1-905-555-8003"}'::jsonb,
 'en', '1975-12-03', 'SNOW001', '2020-11-01', 'active', 'contingent', 'field', 'internal', '["snow_removal", "plow_operation", "salt_spreading", "equipment_maintenance", "winter_operations"]'::jsonb, '["Commercial Driver License", "Snow Plow Operator", "First Aid/CPR"]'::jsonb, '[{"certificate": "Heavy Equipment Operation", "institution": "Ontario Truck Driving School", "year": 1998}]'::jsonb, '["snow_removal", "seasonal", "equipment_operator"]'::jsonb, '{"season": "November_to_March", "equipment_certified": ["plow_truck", "salt_spreader"], "on_call_24_7": true}'),

-- =========== SOLAR INSTALLATION ===========
-- Solar Installation Technician
('Ahmed Hassan', 'Certified Solar Installation Technician - Installation and maintenance of residential solar panel systems', '467 Talbot St, London, ON N6A 2S5', 'ahmed.hassan@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-519-555-9001', '+1-519-555-9002', '{"name": "Fatima Hassan", "relationship": "spouse", "phone": "+1-519-555-9003"}'::jsonb,
 'en', '1987-06-07', 'SOLAR001', '2021-06-01', 'active', 'full_time', 'field', 'internal', '["solar_installation", "electrical_systems", "roof_work", "system_commissioning", "maintenance"]'::jsonb, '["Solar Installation Certified", "Electrical Safety", "Fall Protection", "NABCEP PV Associate"]'::jsonb, '[{"certificate": "Renewable Energy Technology", "institution": "Fanshawe College", "year": 2019}]'::jsonb, '["solar", "installer", "certified"]'::jsonb, '{"location": "london_office", "installations_completed": 150, "warranty_specialist": true}'),

-- =========== CO-OP STUDENT ===========
-- Co-op Student from University of Waterloo
('Jessica Park', 'Co-op Environmental Engineering Student - Supporting sustainability initiatives and energy audit projects', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'jessica.park@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-9101', '+1-905-555-9102', '{"name": "University Co-op Services", "phone": "+1-519-888-4567"}'::jsonb,
 'en', '2003-04-18', 'COOP001', '2024-09-01', 'active', 'co-op', 'hybrid', 'internal', '["environmental_analysis", "energy_auditing", "data_collection", "sustainability_research", "report_writing"]'::jsonb, '["WHMIS Certification", "Environmental Site Assessment"]'::jsonb, '[{"degree": "B.ASc Environmental Engineering", "institution": "University of Waterloo", "year": "2026 (expected)", "gpa": 3.9}]'::jsonb, '["co-op", "environmental", "student"]'::jsonb, '{"co_op_term": "Fall 2024", "academic_program": "Environmental Engineering", "supervisor": "Sarah Chen", "project": "home_energy_efficiency_study"}'),

-- =========== INTERN ===========
-- Summer Intern
('Ryan Kim', 'Summer Marketing Intern - Supporting digital marketing campaigns and customer engagement initiatives', '1250 South Service Rd, Mississauga, ON L5E 1V4', 'ryan.kim@huronhome.ca', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-905-555-9201', '+1-905-555-9202', '{"name": "Parents", "phone": "+1-905-555-9203"}'::jsonb,
 'en', '2004-08-12', 'INT001', '2024-05-01', 'active', 'intern', 'hybrid', 'internal', '["digital_marketing", "social_media", "content_creation", "market_research", "customer_surveys"]'::jsonb, '["Google Analytics", "Social Media Marketing", "Adobe Creative Suite"]'::jsonb, '[{"degree": "Business Marketing (in progress)", "institution": "Toronto Metropolitan University", "year": "2025 (expected)"}]'::jsonb, '["intern", "marketing", "student"]'::jsonb, '{"internship_duration": "4 months", "academic_program": "Business Marketing", "expected_graduation": "2025-06-01", "performance_rating": "excellent"}');
