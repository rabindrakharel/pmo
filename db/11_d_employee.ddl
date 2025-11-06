-- =====================================================
-- EMPLOYEE ENTITY (d_employee) - PERSONNEL & AUTH
-- =====================================================
--
-- SEMANTICS:
-- • RBAC identity foundation: every permission references employee.id
-- • Authentication via email/password_hash (bcrypt), JWT {sub: employee.id}
-- • In-place updates (same ID, version++), soft delete preserves audit trail
--
-- OPERATIONS:
-- • CREATE: INSERT with bcrypt password_hash, version=1, active_flag=true
-- • LOGIN: Query by email, verify with bcrypt.compare(), generate JWT
-- • UPDATE: Same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, termination_date=now(), to_ts=now()
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (RBAC identity, stable)
-- • code: varchar(50) UNIQUE ('EMP-001')
-- • email: varchar(255) UNIQUE (login username)
-- • password_hash: varchar(255) (bcrypt cost=12, never returned by API)
-- • employee_type: varchar(50) (full-time, part-time, contract)
-- • department, title: varchar (org structure)
-- • manager_employee_id: uuid (self-ref for hierarchy)
-- • skills_service_categories: text[] (HVAC, Plumbing, Electrical, etc.)
--
-- RELATIONSHIPS:
-- • Parent: role (via d_entity_id_map)
-- • Self: manager_employee_id → d_employee.id
-- • RBAC: entity_id_rbac_map.empid
--
-- SECURITY:
-- • Account lockout: 5 failed attempts → 30 min lock
-- • Password reset: token expires in 1 hour
--
-- =====================================================

CREATE TABLE app.d_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Employee-specific fields
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255),
  first_name varchar(100),
  last_name varchar(100),

  -- Contact information
  phone varchar(20),
  mobile varchar(20),
  emergency_contact_name varchar(200),
  emergency_contact_phone varchar(20),

  -- Address information
  address_line1 varchar(200),
  address_line2 varchar(200),
  city varchar(100),
  province varchar(100),
  postal_code varchar(20),
  country varchar(100) DEFAULT 'Canada',

  -- Employment details
  employee_type varchar(50) DEFAULT 'full-time', -- full-time, part-time, contract, temporary, intern
  department varchar(100),
  title varchar(200),
  hire_date date,
  termination_date date,

  -- Compensation and HR
  salary_band varchar(50),
  pay_grade varchar(20),
  manager_employee_id uuid, -- Self-reference for reporting structure

  -- Authentication and security
  last_login_ts timestamptz,
  password_reset_token varchar(255),
  password_reset_expires_ts timestamptz,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until_ts timestamptz,

  -- Compliance and tracking
  sin varchar(20), -- Social Insurance Number (Canada)
  birth_date date,
  citizenship varchar(100),
  security_clearance varchar(50),

  -- Work preferences and attributes
  remote_work_eligible_flag boolean DEFAULT false,
  time_zone varchar(50) DEFAULT 'America/Toronto',
  preferred_language varchar(10) DEFAULT 'en',

  -- Skills and certifications
  skills_service_categories text[] DEFAULT ARRAY[]::text[] -- Array of service categories from d_service (HVAC, Plumbing, Electrical, Landscaping, General Contracting, etc.)
);



-- Insert sample employee data for James Miller CEO
INSERT INTO app.d_employee (
    id,
    code,
    name,
    descr,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    mobile,
    address_line1,
    city,
    province,
    postal_code,
    country,
    employee_type,
    department,
    title,
    hire_date,
    salary_band,
    pay_grade,
    sin,
    citizenship,
    security_clearance,
    remote_work_eligible_flag,
    time_zone,
    preferred_language,
    skills_service_categories,
    metadata
) VALUES (
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'EMP-001',
    'James Miller',
    'Chief Executive Officer and Founder of Huron Home Services. Responsible for overall strategic direction, business development, and organizational leadership.',
    'james.miller@huronhome.ca',
    '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', -- hashed: password123
    'James',
    'Miller',
    '+1-519-555-0001',
    '+1-519-555-0101',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada',
    'full-time',
    'Executive',
    'Chief Executive Officer',
    '2020-01-01',
    'Executive',
    'C1',
    '123-456-789',
    'Canadian',
    'Enhanced',
    true,
    'America/Toronto',
    'en',
    ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[], -- CEO has knowledge of all service categories
    '{
        "employee_preferences": {
            "notification_methods": ["email", "sms"],
            "work_hours": {"start": "08:00", "end": "18:00"},
            "signature": "James Miller, CEO\nHuron Home Services\n519-555-0001"
        },
        "authority_levels": {
            "approval_limit_amt": 1000000,
            "budget_authority": "unlimited",
            "hiring_authority": "all_levels"
        }
    }'::jsonb
);

-- Additional sample employees for testing
INSERT INTO app.d_employee (
    code,
    name,
    descr,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    employee_type,
    department,
    title,
    hire_date,
    manager_employee_id,
    skills_service_categories
) VALUES
('EMP-002', 'Sarah Johnson', 'Chief Operating Officer responsible for day-to-day operations', 'sarah.johnson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Sarah', 'Johnson', '+1-519-555-0002', 'full-time', 'Operations', 'Chief Operating Officer', '2020-02-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping']::text[]),
('EMP-003', 'Michael Chen', 'Chief Technology Officer overseeing IT infrastructure and development', 'michael.chen@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Michael', 'Chen', '+1-519-555-0003', 'full-time', 'Technology', 'Chief Technology Officer', '2020-03-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', ARRAY[]::text[]),
('EMP-004', 'Lisa Rodriguez', 'Vice President of Sales managing client relationships and revenue_amt', 'lisa.rodriguez@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Lisa', 'Rodriguez', '+1-519-555-0004', 'full-time', 'Sales', 'Vice President of Sales', '2020-04-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[]),
('EMP-005', 'David Thompson', 'Senior Project Manager for landscaping and maintenance projects', 'david.thompson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'David', 'Thompson', '+1-519-555-0005', 'full-time', 'Operations', 'Senior Project Manager', '2020-05-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', ARRAY['Landscaping']::text[]);

COMMENT ON TABLE app.d_employee IS 'Employee entities with authentication, contact info, and organizational assignments';-- =====================================================
-- COMPREHENSIVE EMPLOYEE DATA GENERATION (500+ Employees)
-- Programmatic generation with realistic Canadian names and addresses
-- =====================================================
--
-- This script generates 500+ employees with:
-- - Realistic Canadian first and last names
-- - Authentic Canadian addresses across provinces
-- - Diverse roles and departments
-- - Proper hierarchical manager assignments
-- - Complete contact information
--
-- TO APPEND TO: 11_d_employee.ddl (after existing INSERT statements)
-- =====================================================

DO $$
DECLARE
    v_first_names text[] := ARRAY[
        'Emma', 'Olivia', 'Ava', 'Sophia', 'Isabella', 'Charlotte', 'Amelia', 'Mia', 'Harper', 'Evelyn',
        'Abigail', 'Emily', 'Ella', 'Elizabeth', 'Camila', 'Luna', 'Sofia', 'Avery', 'Mila', 'Aria',
        'Scarlett', 'Penelope', 'Layla', 'Chloe', 'Victoria', 'Madison', 'Eleanor', 'Grace', 'Nora', 'Riley',
        'Zoey', 'Hannah', 'Hazel', 'Lily', 'Ellie', 'Violet', 'Lillian', 'Zoe', 'Stella', 'Aurora',
        'Natalie', 'Emilia', 'Everly', 'Leah', 'Aubrey', 'Willow', 'Addison', 'Lucy', 'Audrey', 'Bella',
        'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Theodore',
        'Jack', 'Levi', 'Alexander', 'Jackson', 'Mateo', 'Daniel', 'Michael', 'Mason', 'Sebastian', 'Ethan',
        'Logan', 'Owen', 'Samuel', 'Jacob', 'Asher', 'Aiden', 'John', 'Joseph', 'Wyatt', 'David',
        'Leo', 'Luke', 'Julian', 'Hudson', 'Grayson', 'Matthew', 'Ezra', 'Gabriel', 'Carter', 'Isaac',
        'Jayden', 'Luca', 'Anthony', 'Dylan', 'Lincoln', 'Thomas', 'Maverick', 'Elias', 'Josiah', 'Charles'
    ];

    v_last_names text[] := ARRAY[
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
        'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
        'Singh', 'Patel', 'Khan', 'Wong', 'Kim', 'Ng', 'Chen', 'Liu', 'Zhang', 'Wang',
        'O''Brien', 'MacDonald', 'Murphy', 'Sullivan', 'Kelly', 'Ryan', 'Connor', 'Reilly', 'Quinn', 'McCarthy',
        'Leblanc', 'Gagnon', 'Roy', 'Cote', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagne',
        'Tremblay', 'Belanger', 'Bergeron', 'Page', 'Pelletier', 'Simard', 'Girard', 'Ouellet', 'Boucher', 'Cloutier',
        'Kowalski', 'Nowak', 'Wojcik', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Adamczyk', 'Duda', 'Krawczyk'
    ];

    v_cities text[] := ARRAY[
        'Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill',
        'Oakville', 'Burlington', 'Greater Sudbury', 'Oshawa', 'Barrie', 'St. Catharines', 'Cambridge', 'Kingston', 'Guelph', 'Whitby',
        'Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Langley', 'Saanich', 'Delta',
        'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Okotoks',
        'Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Levis', 'Trois-Rivieres', 'Terrebonne',
        'Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie', 'Winkler', 'Selkirk', 'Morden', 'Dauphin', 'The Pas',
        'Halifax', 'Sydney', 'Dartmouth', 'Truro', 'New Glasgow', 'Glace Bay', 'Kentville', 'Amherst', 'Yarmouth', 'Bridgewater',
        'Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster'
    ];

    v_provinces text[] := ARRAY['Ontario', 'British Columbia', 'Alberta', 'Quebec', 'Manitoba', 'Nova Scotia', 'Saskatchewan'];
    v_province_codes text[] := ARRAY['ON', 'BC', 'AB', 'QC', 'MB', 'NS', 'SK'];

    v_streets text[] := ARRAY[
        'Main Street', 'King Street', 'Queen Street', 'Yonge Street', 'Dundas Street', 'Bloor Street', 'College Street',
        'Maple Avenue', 'Oak Drive', 'Pine Road', 'Cedar Lane', 'Birch Court', 'Elm Crescent', 'Willow Way',
        'Park Avenue', 'Lake Road', 'River Drive', 'Hill Street', 'Mountain View', 'Valley Road',
        'First Avenue', 'Second Avenue', 'Third Avenue', 'Fourth Avenue', 'Fifth Avenue', 'Sixth Avenue',
        'Bay Street', 'Front Street', 'Wellington Street', 'Richmond Street', 'Adelaide Street', 'York Street'
    ];

    v_departments text[] := ARRAY[
        'Landscaping', 'Snow Removal', 'HVAC', 'Plumbing', 'Solar Energy', 'Operations',
        'Finance', 'Human Resources', 'IT', 'Marketing', 'Sales', 'Customer Service'
    ];

    v_titles text[] := ARRAY[
        'Field Technician', 'Senior Technician', 'Field Supervisor', 'Coordinator',
        'Specialist', 'Analyst', 'Manager', 'Senior Manager', 'Director'
    ];

    v_first_name text;
    v_last_name text;
    v_full_name text;
    v_email text;
    v_slug text;
    v_code text;
    v_city text;
    v_province text;
    v_postal_code text;
    v_street text;
    v_street_number int;
    v_phone text;
    v_mobile text;
    v_department text;
    v_title text;
    v_emp_type text;
    v_hire_date date;
    v_manager_id uuid;
    v_manager_email text;
    v_skills text[];
    i int;

BEGIN
    -- Generate 500 employees (starting from EMP-026)
    FOR i IN 26..525 LOOP
        -- Randomly select name components
        v_first_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))::int];
        v_last_name := v_last_names[1 + floor(random() * array_length(v_last_names, 1))::int];
        v_full_name := v_first_name || ' ' || v_last_name;

        -- Generate email and identifiers
        v_email := lower(v_first_name || '.' || replace(v_last_name, '''', '') || i || '@huronhome.ca');
        v_slug := lower(replace(v_full_name, ' ', '-') || '-' || i);
        v_code := 'EMP-' || lpad(i::text, 4, '0');

        -- Random Canadian city and province
        v_city := v_cities[1 + floor(random() * array_length(v_cities, 1))::int];
        v_province := v_provinces[1 + floor(random() * array_length(v_provinces, 1))::int];

        -- Generate postal code (Canadian format: A1A 1A1)
        v_postal_code := chr(65 + floor(random() * 26)::int) ||
                        floor(random() * 10)::text ||
                        chr(65 + floor(random() * 26)::int) || ' ' ||
                        floor(random() * 10)::text ||
                        chr(65 + floor(random() * 26)::int) ||
                        floor(random() * 10)::text;

        -- Generate address
        v_street_number := 100 + floor(random() * 9900)::int;
        v_street := v_streets[1 + floor(random() * array_length(v_streets, 1))::int];

        -- Generate phone numbers
        v_phone := '+1-' || (519 + floor(random() * 300)::int)::text || '-555-' || lpad(floor(random() * 10000)::int::text, 4, '0');
        v_mobile := '+1-' || (519 + floor(random() * 300)::int)::text || '-555-' || lpad(floor(random() * 10000)::int::text, 4, '0');

        -- Assign department and title based on employee number
        IF i <= 100 THEN
            v_department := v_departments[1 + floor(random() * 6)::int]; -- Operations departments
            v_title := v_titles[1 + floor(random() * 3)::int]; -- Field positions
            v_emp_type := 'full-time';
            v_manager_email := 'mark.thompson@huronhome.ca'; -- Field supervisor
        ELSIF i <= 200 THEN
            v_department := v_departments[1 + floor(random() * 6)::int];
            v_title := v_titles[1 + floor(random() * 5)::int];
            v_emp_type := 'full-time';
            v_manager_email := CASE floor(random() * 5)::int
                WHEN 0 THEN 'carlos.martinez@huronhome.ca'
                WHEN 1 THEN 'david.kowalski@huronhome.ca'
                WHEN 2 THEN 'amanda.foster@huronhome.ca'
                WHEN 3 THEN 'tony.ricci@huronhome.ca'
                ELSE 'sarah.kim@huronhome.ca'
            END;
        ELSIF i <= 350 THEN
            v_department := v_departments[1 + floor(random() * array_length(v_departments, 1))::int];
            v_title := v_titles[1 + floor(random() * 7)::int];
            v_emp_type := 'full-time';
            v_manager_email := CASE floor(random() * 3)::int
                WHEN 0 THEN 'robert.thompson@huronhome.ca'
                WHEN 1 THEN 'lisa.wang@huronhome.ca'
                ELSE 'michael.oconnor@huronhome.ca'
            END;
        ELSIF i <= 450 THEN
            v_department := v_departments[1 + floor(random() * array_length(v_departments, 1))::int];
            v_title := v_titles[1 + floor(random() * array_length(v_titles, 1))::int];
            v_emp_type := 'part-time';
            v_manager_email := CASE floor(random() * 5)::int
                WHEN 0 THEN 'carlos.martinez@huronhome.ca'
                WHEN 1 THEN 'mark.thompson@huronhome.ca'
                WHEN 2 THEN 'catherine.brooks@huronhome.ca'
                WHEN 3 THEN 'rachel.green@huronhome.ca'
                ELSE 'jennifer.park@huronhome.ca'
            END;
        ELSE
            -- Seasonal workers
            v_department := CASE floor(random() * 2)::int
                WHEN 0 THEN 'Landscaping'
                ELSE 'Snow Removal'
            END;
            v_title := 'Seasonal Worker';
            v_emp_type := 'seasonal';
            v_manager_email := CASE floor(random() * 2)::int
                WHEN 0 THEN 'mark.thompson@huronhome.ca'
                ELSE 'rachel.green@huronhome.ca'
            END;
        END IF;

        -- Assign skills based on department
        CASE v_department
            WHEN 'Landscaping' THEN v_skills := ARRAY['Landscaping']::text[];
            WHEN 'Snow Removal' THEN v_skills := ARRAY['Landscaping']::text[];
            WHEN 'HVAC' THEN v_skills := ARRAY['HVAC']::text[];
            WHEN 'Plumbing' THEN v_skills := ARRAY['Plumbing']::text[];
            WHEN 'Solar Energy' THEN v_skills := ARRAY['Electrical']::text[];
            WHEN 'Operations' THEN v_skills := ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping']::text[];
            WHEN 'Finance' THEN v_skills := ARRAY[]::text[];
            WHEN 'Human Resources' THEN v_skills := ARRAY[]::text[];
            WHEN 'IT' THEN v_skills := ARRAY[]::text[];
            WHEN 'Marketing' THEN v_skills := ARRAY[]::text[];
            WHEN 'Sales' THEN v_skills := ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[];
            WHEN 'Customer Service' THEN v_skills := ARRAY[]::text[];
            ELSE v_skills := ARRAY[]::text[];
        END CASE;

        -- Get manager ID
        SELECT id INTO v_manager_id FROM app.d_employee WHERE email = v_manager_email LIMIT 1;

        -- Generate hire date (between 2021-2024)
        v_hire_date := '2021-01-01'::date + (floor(random() * 1460)::int || ' days')::interval;

        -- Insert employee
        INSERT INTO app.d_employee (
            code, name, descr, email, password_hash,
            first_name, last_name, phone, mobile,
            address_line1, city, province, postal_code, country,
            employee_type, department, title, hire_date, manager_employee_id,
            skills_service_categories
        ) VALUES (
            v_code,
            v_full_name,
            v_title || ' in ' || v_department || ' department',
            v_email,
            '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', -- password123
            v_first_name,
            v_last_name,
            v_phone,
            v_mobile,
            v_street_number || ' ' || v_street,
            v_city,
            v_province,
            v_postal_code,
            'Canada',
            v_emp_type,
            v_department,
            v_title,
            v_hire_date,
            v_manager_id,
            v_skills
        );

    END LOOP;

    RAISE NOTICE '500 employees generated successfully!';
END $$;

-- =====================================================
-- REGISTER ALL EMPLOYEES IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'employee', id, name, code
FROM app.d_employee
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- ASSIGN ROLES TO EMPLOYEES VIA d_entity_id_map
-- =====================================================

-- Clear existing employee-role mappings
DELETE FROM app.d_entity_id_map WHERE child_entity_type = 'employee';

-- Assign roles to all employees based on their titles
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'role',
    r.id::text,
    'employee',
    e.id::text,
    'assigned_to'
FROM app.d_employee e
INNER JOIN app.d_role r ON (
    -- Match employee titles to roles
    (e.title LIKE '%CEO%' AND r.role_code = 'CEO') OR
    (e.title LIKE '%CFO%' OR e.title LIKE '%Chief Financial%' AND r.role_code = 'CFO') OR
    (e.title LIKE '%CTO%' OR e.title LIKE '%Chief Technology%' AND r.role_code = 'CTO') OR
    (e.title LIKE '%COO%' OR e.title LIKE '%Chief Operating%' AND r.role_code = 'COO') OR
    (e.title LIKE '%Senior Vice President%' AND r.role_code = 'SVP') OR
    (e.title LIKE '%Vice President%' AND e.department = 'Human Resources' AND r.role_code = 'VP-HR') OR
    (e.title LIKE '%Director%' AND e.department = 'Finance' AND r.role_code = 'DIR-FIN') OR
    (e.title LIKE '%Director%' AND e.department IN ('IT', 'Technology') AND r.role_code = 'DIR-IT') OR
    (e.title LIKE '%Manager%' AND e.department = 'Landscaping' AND r.role_code = 'MGR-LAND') OR
    (e.title LIKE '%Manager%' AND e.department = 'Snow Removal' AND r.role_code = 'MGR-SNOW') OR
    (e.title LIKE '%Manager%' AND e.department = 'HVAC' AND r.role_code = 'MGR-HVAC') OR
    (e.title LIKE '%Manager%' AND e.department = 'Plumbing' AND r.role_code = 'MGR-PLUMB') OR
    (e.title LIKE '%Manager%' AND e.department = 'Solar Energy' AND r.role_code = 'MGR-SOLAR') OR
    (e.title LIKE '%Field Supervisor%' AND r.role_code = 'SUP-FIELD') OR
    (e.title LIKE '%Senior Technician%' AND r.role_code = 'TECH-SR') OR
    (e.title LIKE '%Field Technician%' AND r.role_code = 'TECH-FIELD') OR
    (e.title LIKE '%Project Coordinator%' AND r.role_code = 'COORD-PROJ') OR
    (e.title LIKE '%Financial Analyst%' AND r.role_code = 'ANALYST-FIN') OR
    (e.title LIKE '%HR Coordinator%' AND r.role_code = 'COORD-HR') OR
    (e.title LIKE '%IT Administrator%' AND r.role_code = 'ADMIN-IT') OR
    (e.title LIKE '%Seasonal Worker%' AND r.role_code = 'SEASONAL') OR
    (e.title LIKE '%Part-time%' OR e.employee_type = 'part-time' AND r.role_code = 'PT-SUPPORT')
)
WHERE e.active_flag = true;

-- Assign generic field technician role to any employee without a role match
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'role',
    (SELECT id FROM app.d_role WHERE role_code = 'TECH-FIELD')::text,
    'employee',
    e.id::text,
    'assigned_to'
FROM app.d_employee e
WHERE e.active_flag = true
  AND NOT EXISTS (
    SELECT 1 FROM app.d_entity_id_map eim
    WHERE eim.child_entity_id = e.id::text
      AND eim.child_entity_type = 'employee'
      AND eim.parent_entity_type = 'role'
  );

-- Show statistics
SELECT
    r.name as role_name,
    COUNT(*) as employee_count
FROM app.d_entity_id_map eim
INNER JOIN app.d_role r ON r.id::text = eim.parent_entity_id
WHERE eim.parent_entity_type = 'role'
  AND eim.child_entity_type = 'employee'
  AND eim.active_flag = true
GROUP BY r.name
ORDER BY employee_count DESC;

COMMENT ON TABLE app.d_employee IS 'Employee table with 500+ curated records across all departments and roles';
