-- =====================================================
-- EMPLOYEE ENTITY (employee) - PERSONNEL & PROFILE
-- =====================================================
--
-- SEMANTICS:
-- • Employee profile and contact information
-- • Personal details (name, address) stored HERE, not in person table
-- • Authentication handled by app.person table (person_id FK)
-- • RBAC references person.id for permission checks
--
-- OPERATIONS:
-- • CREATE: First create person record, then INSERT employee with person_id
-- • LOGIN: Query person by email, verify password, get employee profile via JOIN
-- • UPDATE: Same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, termination_date=now(), to_ts=now()
--
-- RELATIONSHIPS (NO FOREIGN KEYS except person_id):
-- • Parent: person (person_id) - for auth/RBAC
-- • Parent: role (via entity_instance_link)
-- • Self: manager__employee_id → employee.id
-- • RBAC: entity_rbac.person_id (via person table)
--
-- =====================================================

CREATE TABLE app.employee (
  id uuid DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200), -- Display name (first + last)
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Link to Person (for auth/RBAC)
  -- ─────────────────────────────────────────────────────────────────────────
  person_id uuid, -- References app.person.id (auth hub)

  -- ─────────────────────────────────────────────────────────────────────────
  -- Personal Information (stored HERE, not in person)
  -- ─────────────────────────────────────────────────────────────────────────
  first_name varchar(100),
  last_name varchar(100),
  preferred_name varchar(100), -- Nickname or preferred name
  email varchar(255), -- Work email (display only, auth uses person.email)

  -- ─────────────────────────────────────────────────────────────────────────
  -- Contact Information
  -- ─────────────────────────────────────────────────────────────────────────
  phone varchar(50),
  mobile varchar(50),
  emergency_contact_name varchar(200),
  emergency_contact_phone varchar(50),
  emergency_contact_relationship varchar(50),

  -- ─────────────────────────────────────────────────────────────────────────
  -- Address Information
  -- ─────────────────────────────────────────────────────────────────────────
  address_line1 varchar(200),
  address_line2 varchar(200),
  city varchar(100),
  province varchar(100),
  postal_code varchar(20),
  country varchar(100) DEFAULT 'Canada',

  -- ─────────────────────────────────────────────────────────────────────────
  -- Employment Details
  -- ─────────────────────────────────────────────────────────────────────────
  dl__employee_employment_type text, -- References app.datalabel
  department varchar(100),
  title varchar(200),
  hire_date date,
  termination_date date,
  probation_end_date date,

  -- ─────────────────────────────────────────────────────────────────────────
  -- Compensation and HR
  -- ─────────────────────────────────────────────────────────────────────────
  salary_band varchar(50),
  pay_grade varchar(20),
  manager__employee_id uuid, -- Self-reference for reporting structure

  -- ─────────────────────────────────────────────────────────────────────────
  -- Compliance and Tracking
  -- ─────────────────────────────────────────────────────────────────────────
  sin varchar(20), -- Social Insurance Number (Canada)
  birth_date date,
  dl__employee_citizenship_status text, -- References app.datalabel
  dl__employee_security_clearance text, -- References app.datalabel

  -- ─────────────────────────────────────────────────────────────────────────
  -- Work Preferences and Attributes
  -- ─────────────────────────────────────────────────────────────────────────
  remote_work_eligible_flag boolean DEFAULT false,
  time_zone varchar(50) DEFAULT 'America/Toronto',
  preferred_language varchar(10) DEFAULT 'en',

  -- ─────────────────────────────────────────────────────────────────────────
  -- Skills and Certifications
  -- ─────────────────────────────────────────────────────────────────────────
  skills_service_categories text[] DEFAULT ARRAY[]::text[],

  -- ─────────────────────────────────────────────────────────────────────────
  -- Profile Photo (S3 storage)
  -- ─────────────────────────────────────────────────────────────────────────
  profile_photo_url jsonb DEFAULT NULL
);

COMMENT ON TABLE app.employee IS 'Employee entities with contact info, address, and organizational assignments. Auth via app.person (person_id)';
COMMENT ON COLUMN app.employee.person_id IS 'Link to app.person for authentication and RBAC';
COMMENT ON COLUMN app.employee.first_name IS 'Employee first name';
COMMENT ON COLUMN app.employee.last_name IS 'Employee last name';

-- =====================================================
-- DATA CURATION
-- =====================================================

-- Create person records first (auth hub)
-- Then create employee records with person_id reference

-- James Miller CEO - Person record
INSERT INTO app.person (
    id,
    code,
    name,
    entity_code,
    email,
    password_hash,
    email_verified_flag,
    tos_accepted_flag,
    tos_accepted_ts,
    login_count
) VALUES (
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'PER-001',
    'James Miller',
    'employee',
    'james.miller@huronhome.ca',
    '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', -- password123
    true,
    true,
    now(),
    0
);

-- James Miller CEO - Employee record
INSERT INTO app.employee (
    id,
    code,
    name,
    descr,
    person_id,
    first_name,
    last_name,
    email,
    phone,
    mobile,
    address_line1,
    city,
    province,
    postal_code,
    country,
    dl__employee_employment_type,
    department,
    title,
    hire_date,
    salary_band,
    pay_grade,
    sin,
    dl__employee_citizenship_status,
    dl__employee_security_clearance,
    remote_work_eligible_flag,
    time_zone,
    preferred_language,
    skills_service_categories,
    metadata
) VALUES (
    'e8260b1b-5efc-4611-ad33-ee76c0cf7f13', -- Different UUID than person
    'EMP-001',
    'James Miller',
    'Chief Executive Officer and Founder of Huron Home Services. Responsible for overall strategic direction, business development, and organizational leadership.',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', -- person_id
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    '+1-519-555-0001',
    '+1-519-555-0101',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada',
    'Full-time',
    'Executive',
    'Chief Executive Officer',
    '2020-01-01',
    'Executive',
    'C1',
    '123-456-789',
    'Canadian Citizen',
    'Enhanced',
    true,
    'America/Toronto',
    'en',
    ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[],
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

-- Update person with employee_id reference
UPDATE app.person SET employee_id = 'e8260b1b-5efc-4611-ad33-ee76c0cf7f13' WHERE id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13';

-- =====================================================
-- Additional Sample Employees
-- =====================================================

-- Person records for C-suite
INSERT INTO app.person (code, name, entity_code, email, password_hash, email_verified_flag) VALUES
('PER-002', 'Sarah Johnson', 'employee', 'sarah.johnson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true),
('PER-003', 'Michael Chen', 'employee', 'michael.chen@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true),
('PER-004', 'Lisa Rodriguez', 'employee', 'lisa.rodriguez@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true),
('PER-005', 'David Thompson', 'employee', 'david.thompson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', true);

-- Employee records for C-suite
INSERT INTO app.employee (
    code,
    name,
    descr,
    person_id,
    first_name,
    last_name,
    email,
    phone,
    dl__employee_employment_type,
    department,
    title,
    hire_date,
    manager__employee_id,
    skills_service_categories
)
SELECT
    v.code,
    v.name,
    v.descr,
    p.id as person_id,
    split_part(v.name, ' ', 1) as first_name,
    split_part(v.name, ' ', 2) as last_name,
    v.email,
    v.phone,
    v.emp_type,
    v.department,
    v.title,
    v.hire_date::date,
    'e8260b1b-5efc-4611-ad33-ee76c0cf7f13' as manager__employee_id, -- Reports to CEO
    v.skills
FROM app.person p
INNER JOIN (VALUES
    ('PER-002', 'EMP-002', 'Sarah Johnson', 'sarah.johnson@huronhome.ca', 'Chief Operating Officer responsible for day-to-day operations', '+1-519-555-0002', 'Full-time', 'Operations', 'Chief Operating Officer', '2020-02-01', ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping']::text[]),
    ('PER-003', 'EMP-003', 'Michael Chen', 'michael.chen@huronhome.ca', 'Chief Technology Officer overseeing IT infrastructure and development', '+1-519-555-0003', 'Full-time', 'Technology', 'Chief Technology Officer', '2020-03-01', ARRAY[]::text[]),
    ('PER-004', 'EMP-004', 'Lisa Rodriguez', 'lisa.rodriguez@huronhome.ca', 'Vice President of Sales managing client relationships and revenue', '+1-519-555-0004', 'Full-time', 'Sales', 'Vice President of Sales', '2020-04-01', ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[]),
    ('PER-005', 'EMP-005', 'David Thompson', 'david.thompson@huronhome.ca', 'Senior Project Manager for landscaping and maintenance projects', '+1-519-555-0005', 'Full-time', 'Operations', 'Senior Project Manager', '2020-05-01', ARRAY['Landscaping']::text[])
) AS v(per_code, code, name, email, descr, phone, emp_type, department, title, hire_date, skills)
ON p.code = v.per_code;

-- Update person records with employee_id references
UPDATE app.person p
SET employee_id = e.id
FROM app.employee e
WHERE e.person_id = p.id AND p.employee_id IS NULL;

-- =====================================================
-- COMPREHENSIVE EMPLOYEE DATA GENERATION (500+ Employees)
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
    v_per_code text;
    v_emp_code text;
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
    v_skills text[];
    v_person_id uuid;
    i int;

BEGIN
    -- Generate 500 employees (starting from EMP-026)
    FOR i IN 26..525 LOOP
        -- Randomly select name components
        v_first_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))::int];
        v_last_name := v_last_names[1 + floor(random() * array_length(v_last_names, 1))::int];
        v_full_name := v_first_name || ' ' || v_last_name;

        -- Generate email and identifiers
        v_email := lower(replace(replace(v_full_name, ' ', '.'), '''', '') || i || '@huronhome.ca');
        v_per_code := 'PER-' || lpad(i::text, 4, '0');
        v_emp_code := 'EMP-' || lpad(i::text, 4, '0');

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
            v_department := v_departments[1 + floor(random() * 6)::int];
            v_title := v_titles[1 + floor(random() * 3)::int];
            v_emp_type := 'Full-time';
        ELSIF i <= 200 THEN
            v_department := v_departments[1 + floor(random() * 6)::int];
            v_title := v_titles[1 + floor(random() * 5)::int];
            v_emp_type := 'Full-time';
        ELSIF i <= 350 THEN
            v_department := v_departments[1 + floor(random() * array_length(v_departments, 1))::int];
            v_title := v_titles[1 + floor(random() * 7)::int];
            v_emp_type := 'Full-time';
        ELSIF i <= 450 THEN
            v_department := v_departments[1 + floor(random() * array_length(v_departments, 1))::int];
            v_title := v_titles[1 + floor(random() * array_length(v_titles, 1))::int];
            v_emp_type := 'Part-time';
        ELSE
            v_department := CASE floor(random() * 2)::int
                WHEN 0 THEN 'Landscaping'
                ELSE 'Snow Removal'
            END;
            v_title := 'Seasonal Worker';
            v_emp_type := 'Seasonal';
        END IF;

        -- Assign skills based on department
        CASE v_department
            WHEN 'Landscaping' THEN v_skills := ARRAY['Landscaping']::text[];
            WHEN 'Snow Removal' THEN v_skills := ARRAY['Landscaping']::text[];
            WHEN 'HVAC' THEN v_skills := ARRAY['HVAC']::text[];
            WHEN 'Plumbing' THEN v_skills := ARRAY['Plumbing']::text[];
            WHEN 'Solar Energy' THEN v_skills := ARRAY['Electrical']::text[];
            WHEN 'Operations' THEN v_skills := ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping']::text[];
            WHEN 'Sales' THEN v_skills := ARRAY['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General Contracting']::text[];
            ELSE v_skills := ARRAY[]::text[];
        END CASE;

        -- Default manager to CEO for simplicity
        v_manager_id := 'e8260b1b-5efc-4611-ad33-ee76c0cf7f13';

        -- Generate hire date (between 2021-2024)
        v_hire_date := '2021-01-01'::date + (floor(random() * 1460)::int || ' days')::interval;

        -- Generate new person_id
        v_person_id := gen_random_uuid();

        -- Insert person record (auth hub)
        INSERT INTO app.person (
            id,
            code,
            name,
            entity_code,
            email,
            password_hash,
            email_verified_flag
        ) VALUES (
            v_person_id,
            v_per_code,
            v_full_name,
            'employee',
            v_email,
            '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', -- password123
            true
        );

        -- Insert employee record
        INSERT INTO app.employee (
            code, name, descr, person_id,
            first_name, last_name, email,
            phone, mobile,
            address_line1, city, province, postal_code, country,
            dl__employee_employment_type, department, title, hire_date, manager__employee_id,
            skills_service_categories
        ) VALUES (
            v_emp_code,
            v_full_name,
            v_title || ' in ' || v_department || ' department',
            v_person_id,
            v_first_name,
            v_last_name,
            v_email,
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

-- Update person records with employee_id references (for generated employees)
UPDATE app.person p
SET employee_id = e.id
FROM app.employee e
WHERE e.person_id = p.id AND p.employee_id IS NULL;

-- =====================================================
-- REGISTER ALL EMPLOYEES IN entity_instance
-- =====================================================

INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'employee', id, name, code
FROM app.employee
WHERE active_flag = true;

-- =====================================================
-- ROLE-PERSON MEMBERSHIP
-- =====================================================
-- NOTE: Role-person membership assignment is done in 09_role.ddl
-- because roles must exist before they can be linked to persons.
-- See 09_role.ddl for the RBAC v2.0.0 role-person assignment logic.

-- =====================================================
-- Sync person.name from employee.name
-- This denormalization enables fast role-person lookups
-- =====================================================
UPDATE app.person p
SET name = e.name
FROM app.employee e
WHERE e.person_id = p.id
  AND p.entity_code = 'employee';
