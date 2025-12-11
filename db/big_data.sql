-- ============================================================================
-- BIG DATA: CONSOLIDATED DATA GENERATION + RBAC + INDEXES
-- ============================================================================
--
-- RUN MANUALLY: psql -h localhost -p 5434 -U app -d app -f db/big_data.sql
-- NOT included in db-import.sh (run separately for performance testing)
--
-- MERGED FILES:
--   - entity_configuration_settings/04_entity_instance_backfill.ddl
--   - Original big_data.sql content (300 businesses, 3K projects, 30K tasks)
--   - 49_rbac_seed_data.ddl
--   - entity_configuration_settings/07_entity_indexes.ddl
--
-- EXECUTION ORDER:
--   1. Entity Instance Backfill (registry population)
--   2. Big Data Generation (businesses, projects, tasks)
--   3. RBAC Seed Data (role permissions)
--   4. Entity Infrastructure Indexes (performance)
--
-- ============================================================================


-- ############################################################################
-- SECTION 1: ENTITY INSTANCE REGISTRY BACKFILL
-- ############################################################################
-- Populates entity_instance table with all existing entity instances from
-- primary tables. This enables:
--   - Entity dropdown caches (prefetchEntityInstances on login)
--   - ref_data_entityInstance resolution in API responses
--   - Entity name lookups for foreign key references
-- ============================================================================

-- ============================================================================
-- CUSTOMER 360 DOMAIN
-- ============================================================================

-- Backfill employees (primary entity for dropdowns)
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'employee', id, name, code
FROM app.employee
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill offices
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'office', id, name, code
FROM app.office
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill businesses
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'business', id, name, code
FROM app.business
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill customers
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'customer', id, name, code
FROM app.cust
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill roles
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'role', id, name, code
FROM app.role
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill suppliers
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'supplier', id, name, code
FROM app.supplier
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill worksites
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'worksite', id, name, code
FROM app.worksite
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- OPERATIONS DOMAIN
-- ============================================================================

-- Backfill projects
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'project', id, name, code
FROM app.project
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill tasks
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'task', id, name, code
FROM app.task
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill work orders
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'work_order', id, name, code
FROM app.work_order
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill services
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'service', id, name, code
FROM app.service
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PRODUCT & INVENTORY DOMAIN
-- ============================================================================

-- Backfill products
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'product', id, name, code
FROM app.product
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill inventory
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'inventory', id, name, code
FROM app.inventory
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ORDER & FULFILLMENT DOMAIN
-- ============================================================================

-- Backfill quotes
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'quote', id, name, code
FROM app.quote
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill orders
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'order', id, name, code
FROM app.order
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill shipments
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'shipment', id, name, code
FROM app.shipment
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill invoices
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'invoice', id, name, code
FROM app.invoice
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FINANCIAL DOMAIN
-- ============================================================================

-- Backfill revenue
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'revenue', id, name, code
FROM app.revenue
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill expenses
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'expense', id, name, code
FROM app.expense
WHERE active_flag = true
ON CONFLICT DO NOTHING;


-- ############################################################################
-- SECTION 2: BIG DATA GENERATION (300 Businesses + 3K Projects + 30K Tasks)
-- ############################################################################
--
-- Distribution (1:10 ratios):
-- - 300 businesses (Canadian home services operational teams)
-- - 3,000 projects distributed across businesses (10 per business)
-- - 30,000 tasks distributed across projects (10 per project)
--
-- Realistic Canadian home services data with:
-- - Regional distribution across Ontario offices
-- - Service type specialization (Landscaping, HVAC, Property Maintenance, Corporate)
-- - Varied project stages and task priorities
-- ============================================================================

-- ============================================================================
-- STEP 2.1: GENERATE 300 BUSINESSES
-- ============================================================================

DO $$
DECLARE
    -- Office IDs (actual from app.office table)
    office_ids uuid[] := ARRAY[
        '62b1221c-bba7-4156-8b24-7ce670cde1ce',  -- Corporate Office - London
        'f7bc8ec9-60fa-4782-89de-417194020c35',  -- London Service Office - Main
        '912a4420-1a61-41e2-8be5-18b2b9d953da',  -- Toronto Downtown Office
        '48248f8b-d88a-45bf-8879-2f71b091aa3d',  -- Mississauga Service Center
        '74d0f844-6e10-4bcf-985e-327be2caf7c1',  -- Kitchener Service Office
        '346bd45a-e864-4de6-a596-4ae8cc9fcb85'   -- London Central Warehouse
    ];

    -- Service categories
    service_categories text[] := ARRAY[
        'Landscaping', 'HVAC', 'Property Maintenance', 'Plumbing',
        'Electrical', 'Roofing', 'Flooring', 'Painting',
        'Renovation', 'Corporate Services'
    ];

    -- Team name modifiers
    team_modifiers text[] := ARRAY[
        'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
        'Premier', 'Elite', 'Pro', 'Expert', 'Master', 'Specialist', 'Advanced', 'Senior',
        'North', 'South', 'East', 'West', 'Central', 'Metro', 'Regional', 'Express',
        'Plus', 'Prime', 'Select', 'Choice', 'Premium', 'Standard'
    ];

    -- Canadian regions for team specialization
    regions text[] := ARRAY[
        'Toronto', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Ottawa',
        'Kitchener', 'Burlington', 'Oakville', 'Vaughan', 'Richmond Hill',
        'Markham', 'Pickering', 'Ajax', 'Oshawa', 'Whitby', 'Barrie',
        'Guelph', 'Cambridge', 'Waterloo', 'St. Catharines', 'Niagara Falls',
        'Windsor', 'Sudbury', 'Kingston', 'Peterborough', 'Thunder Bay'
    ];

    -- Operational status options
    operational_statuses text[] := ARRAY['Active', 'Active', 'Active', 'Active', 'Active', 'Restructuring', 'Active', 'Active'];

    i integer;
    business_id uuid;
    service_category text;
    team_modifier text;
    region text;
    office_idx integer;
    headcount integer;
    operational_status text;
    business_code text;
    business_name text;
    business_descr text;

BEGIN
    RAISE NOTICE 'Step 2.1: Generating 300 businesses...';

    FOR i IN 1..300 LOOP
        business_id := gen_random_uuid();

        -- Select service category (distribute evenly)
        service_category := service_categories[((i - 1) % array_length(service_categories, 1)) + 1];

        -- Select team modifier (cycle through)
        team_modifier := team_modifiers[((i - 1) % array_length(team_modifiers, 1)) + 1];

        -- Select region (cycle through)
        region := regions[((i - 1) % array_length(regions, 1)) + 1];

        -- Distribute across offices
        office_idx := ((i - 1) % array_length(office_ids, 1)) + 1;

        -- Random headcount (5-25)
        headcount := 5 + floor(random() * 20)::int;

        -- Mostly active
        operational_status := operational_statuses[1 + floor(random() * array_length(operational_statuses, 1))::int];

        -- Build business details
        business_code := 'BIZ-' || UPPER(LEFT(service_category, 4)) || '-' || LPAD(i::text, 4, '0');
        business_name := service_category || ' Team ' || team_modifier || ' - ' || region;
        business_descr := service_category || ' services team operating in ' || region ||
                          ' area. Specializing in residential and commercial ' ||
                          LOWER(service_category) || ' services with ' || headcount ||
                          ' trained professionals.';

        INSERT INTO app.business (
            id, code, name, descr, metadata,
            office_id, current_headcount, operational_status,
            active_flag
        ) VALUES (
            business_id,
            business_code,
            business_name,
            business_descr,
            jsonb_build_object(
                'service_category', service_category,
                'region', region,
                'team_modifier', team_modifier,
                'generated', true,
                'batch', 'big_data_300'
            ),
            office_ids[office_idx],
            headcount,
            operational_status,
            true
        );

        -- Progress indicator every 50 businesses
        IF i % 50 = 0 THEN
            RAISE NOTICE '  Generated % businesses...', i;
        END IF;
    END LOOP;

    RAISE NOTICE 'Completed: 300 businesses generated!';
END $$;

-- ============================================================================
-- STEP 2.2: GENERATE 3,000 PROJECTS (10 per business)
-- ============================================================================

DO $$
DECLARE
    -- Project stages
    project_stages text[] := ARRAY['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closure', 'On Hold'];

    -- Project type prefixes by service category
    landscaping_projects text[] := ARRAY[
        'Residential Lawn Care Program', 'Commercial Grounds Maintenance', 'Garden Design Installation',
        'Landscape Renovation', 'Seasonal Cleanup Campaign', 'Tree Service Contract',
        'Irrigation System Install', 'Hardscape Construction', 'Mulching Program',
        'Sod Installation Project', 'Flower Bed Design', 'Hedge Maintenance Contract'
    ];

    hvac_projects text[] := ARRAY[
        'Furnace Installation Program', 'AC Replacement Contract', 'Heat Pump Deployment',
        'Duct Cleaning Campaign', 'HVAC Maintenance Program', 'Ventilation Upgrade',
        'Smart Thermostat Rollout', 'Air Quality Improvement', 'Boiler Service Contract',
        'Geothermal Installation', 'Radiant Heating Project', 'Mini Split Campaign'
    ];

    maintenance_projects text[] := ARRAY[
        'Roof Repair Program', 'Window Replacement Contract', 'Door Installation Campaign',
        'Deck Construction Project', 'Fence Repair Program', 'Gutter Service Contract',
        'Pressure Washing Campaign', 'Exterior Painting Project', 'Drywall Repair Program',
        'Flooring Installation', 'General Maintenance Contract', 'Emergency Repair Program'
    ];

    plumbing_projects text[] := ARRAY[
        'Pipe Replacement Program', 'Drain Cleaning Campaign', 'Water Heater Installation',
        'Fixture Upgrade Project', 'Leak Detection Program', 'Sewer Line Repair',
        'Bathroom Plumbing Renovation', 'Kitchen Plumbing Upgrade', 'Water Filtration Install',
        'Backflow Prevention Program', 'Sump Pump Installation', 'Emergency Plumbing Contract'
    ];

    electrical_projects text[] := ARRAY[
        'Panel Upgrade Program', 'Wiring Renovation Project', 'Lighting Installation',
        'Outlet Expansion Campaign', 'Smart Home Electrical', 'Generator Installation',
        'EV Charger Deployment', 'Commercial Electrical Contract', 'Safety Inspection Program',
        'Energy Efficiency Upgrade', 'Surge Protection Install', 'Emergency Electrical Service'
    ];

    corporate_projects text[] := ARRAY[
        'Digital Transformation Initiative', 'Process Improvement Program', 'Training Development',
        'Compliance Audit Project', 'Quality Assurance Program', 'Customer Experience Enhancement',
        'IT Infrastructure Upgrade', 'Fleet Management Optimization', 'Safety Program Development',
        'Cost Reduction Initiative', 'Employee Wellness Program', 'Data Analytics Implementation'
    ];

    -- Client types
    client_types text[] := ARRAY[
        'Residential', 'Commercial', 'Industrial', 'Municipal', 'Institutional',
        'Retail', 'Healthcare', 'Educational', 'Hospitality', 'Multi-Family'
    ];

    -- Variables
    business_rec record;
    i integer;
    project_id uuid;
    project_prefix text;
    project_name text;
    project_descr text;
    project_code text;
    project_stage text;
    client_type text;
    budget decimal;
    start_date date;
    end_date date;
    service_category text;
    project_count integer := 0;

BEGIN
    RAISE NOTICE 'Step 2.2: Generating 3,000 projects (10 per business)...';

    -- Loop through all businesses with generated=true
    FOR business_rec IN
        SELECT id, name, metadata->>'service_category' as service_cat, metadata->>'region' as region
        FROM app.business
        WHERE metadata->>'generated' = 'true' AND metadata->>'batch' = 'big_data_300'
        ORDER BY created_ts
    LOOP
        service_category := business_rec.service_cat;

        -- Generate 10 projects per business
        FOR i IN 1..10 LOOP
            project_id := gen_random_uuid();
            project_count := project_count + 1;

            -- Select project prefix based on service category
            CASE service_category
                WHEN 'Landscaping' THEN
                    project_prefix := landscaping_projects[1 + floor(random() * array_length(landscaping_projects, 1))::int];
                WHEN 'HVAC' THEN
                    project_prefix := hvac_projects[1 + floor(random() * array_length(hvac_projects, 1))::int];
                WHEN 'Property Maintenance' THEN
                    project_prefix := maintenance_projects[1 + floor(random() * array_length(maintenance_projects, 1))::int];
                WHEN 'Plumbing' THEN
                    project_prefix := plumbing_projects[1 + floor(random() * array_length(plumbing_projects, 1))::int];
                WHEN 'Electrical' THEN
                    project_prefix := electrical_projects[1 + floor(random() * array_length(electrical_projects, 1))::int];
                WHEN 'Corporate Services' THEN
                    project_prefix := corporate_projects[1 + floor(random() * array_length(corporate_projects, 1))::int];
                ELSE
                    project_prefix := maintenance_projects[1 + floor(random() * array_length(maintenance_projects, 1))::int];
            END CASE;

            -- Random client type
            client_type := client_types[1 + floor(random() * array_length(client_types, 1))::int];

            -- Build project details
            project_code := 'PRJ-' || LPAD(project_count::text, 6, '0');
            project_name := project_prefix || ' - ' || business_rec.region || ' ' || client_type || ' #' || i;
            project_descr := project_prefix || ' for ' || client_type || ' client in ' || business_rec.region ||
                            ' area. Managed by ' || business_rec.name || '. ' ||
                            'Full service delivery including planning, execution, and quality assurance.';

            -- Random project stage (weighted towards active)
            project_stage := project_stages[1 + floor(random() * array_length(project_stages, 1))::int];

            -- Random budget (10000 to 500000)
            budget := 10000 + floor(random() * 490000);

            -- Random dates (within 2024-2025)
            start_date := '2024-01-01'::date + (floor(random() * 400) || ' days')::interval;
            end_date := start_date + ((30 + floor(random() * 300)) || ' days')::interval;

            INSERT INTO app.project (
                id, code, name, descr, metadata,
                dl__project_stage,
                budget_allocated_amt, budget_spent_amt,
                planned_start_date, planned_end_date,
                manager__employee_id, sponsor__employee_id,
                active_flag
            ) VALUES (
                project_id,
                project_code,
                project_name,
                project_descr,
                jsonb_build_object(
                    'business_id', business_rec.id,
                    'service_category', service_category,
                    'client_type', client_type,
                    'region', business_rec.region,
                    'generated', true,
                    'batch', 'big_data_3000'
                ),
                project_stage,
                budget,
                budget * (random() * 0.6),
                start_date,
                end_date,
                '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
                '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
                true
            );
        END LOOP;

        -- Progress indicator every 30 businesses (300 projects)
        IF project_count % 300 = 0 THEN
            RAISE NOTICE '  Generated % projects...', project_count;
        END IF;
    END LOOP;

    RAISE NOTICE 'Completed: % projects generated!', project_count;
END $$;

-- ============================================================================
-- STEP 2.3: GENERATE 30,000 TASKS (10 per project)
-- ============================================================================

DO $$
DECLARE
    -- Task stages
    task_stages text[] := ARRAY['Backlog', 'Planning', 'To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'];

    -- Task priorities
    task_priorities text[] := ARRAY['low', 'medium', 'high', 'critical'];

    -- Task name templates by phase
    planning_tasks text[] := ARRAY[
        'Initial Site Assessment', 'Client Requirements Gathering', 'Design Review Meeting',
        'Budget Planning and Approval', 'Resource Allocation Plan', 'Schedule Development',
        'Risk Assessment Analysis', 'Permit Application Filing', 'Subcontractor Selection',
        'Material Specification Review'
    ];

    execution_tasks text[] := ARRAY[
        'Site Preparation Work', 'Material Procurement', 'Equipment Setup',
        'Primary Installation Work', 'Quality Checkpoint 1', 'Progress Documentation',
        'Client Progress Update', 'Mid-Project Inspection', 'Adjustment Implementation',
        'Secondary Installation Phase'
    ];

    completion_tasks text[] := ARRAY[
        'Final Quality Inspection', 'Client Walkthrough', 'Punch List Resolution',
        'Documentation Completion', 'Handover Preparation', 'Warranty Setup',
        'Client Training Session', 'Final Photography', 'Project Closeout Report',
        'Customer Satisfaction Survey'
    ];

    admin_tasks text[] := ARRAY[
        'Invoice Preparation', 'Payment Follow-up', 'Vendor Coordination',
        'Safety Compliance Check', 'Equipment Maintenance Log', 'Team Schedule Update',
        'Status Report Generation', 'Stakeholder Communication', 'Change Order Processing',
        'Budget Reconciliation'
    ];

    -- Variables
    project_rec record;
    i integer;
    task_id uuid;
    task_name text;
    task_descr text;
    task_code text;
    task_stage text;
    task_priority text;
    estimated_hours numeric;
    actual_hours numeric;
    story_points integer;
    task_count integer := 0;
    task_phase integer;

BEGIN
    RAISE NOTICE 'Step 2.3: Generating 30,000 tasks (10 per project)...';

    -- Loop through all projects with generated=true
    FOR project_rec IN
        SELECT id, code, name, metadata->>'service_category' as service_cat, metadata->>'business_id' as business_id
        FROM app.project
        WHERE metadata->>'generated' = 'true' AND metadata->>'batch' = 'big_data_3000'
        ORDER BY created_ts
    LOOP
        -- Generate 10 tasks per project
        FOR i IN 1..10 LOOP
            task_id := gen_random_uuid();
            task_count := task_count + 1;

            -- Determine task phase (distribute across project lifecycle)
            task_phase := ((i - 1) % 4) + 1;

            -- Select task name based on phase
            CASE task_phase
                WHEN 1 THEN
                    task_name := planning_tasks[1 + floor(random() * array_length(planning_tasks, 1))::int];
                WHEN 2 THEN
                    task_name := execution_tasks[1 + floor(random() * array_length(execution_tasks, 1))::int];
                WHEN 3 THEN
                    task_name := completion_tasks[1 + floor(random() * array_length(completion_tasks, 1))::int];
                ELSE
                    task_name := admin_tasks[1 + floor(random() * array_length(admin_tasks, 1))::int];
            END CASE;

            -- Build task details
            task_code := 'TSK-' || LPAD(task_count::text, 6, '0');
            task_descr := task_name || ' for project ' || project_rec.name || '. ' ||
                         'Part of ' || project_rec.service_cat || ' service delivery. ' ||
                         'Task ' || i || ' of 10 in project workflow.';

            -- Random task stage (weighted distribution)
            task_stage := task_stages[1 + floor(random() * array_length(task_stages, 1))::int];

            -- Random priority
            task_priority := task_priorities[1 + floor(random() * array_length(task_priorities, 1))::int];

            -- Random hours (2 to 60)
            estimated_hours := 2 + floor(random() * 58);

            -- Actual hours based on stage
            actual_hours := CASE
                WHEN task_stage IN ('Completed', 'In Review') THEN estimated_hours * (0.8 + random() * 0.4)
                WHEN task_stage = 'In Progress' THEN estimated_hours * random() * 0.7
                ELSE 0
            END;

            -- Story points based on priority
            story_points := CASE task_priority
                WHEN 'critical' THEN 13
                WHEN 'high' THEN 8
                WHEN 'medium' THEN 5
                ELSE 3
            END;

            INSERT INTO app.task (
                id, code, name, descr, metadata,
                dl__task_stage, dl__task_priority,
                estimated_hours, actual_hours, story_points,
                active_flag
            ) VALUES (
                task_id,
                task_code,
                task_name || ' - ' || project_rec.code,
                task_descr,
                jsonb_build_object(
                    'project_id', project_rec.id,
                    'business_id', project_rec.business_id,
                    'service_category', project_rec.service_cat,
                    'task_phase', task_phase,
                    'task_number', i,
                    'generated', true,
                    'batch', 'big_data_30000'
                ),
                task_stage,
                task_priority,
                estimated_hours,
                actual_hours,
                story_points,
                true
            );
        END LOOP;

        -- Progress indicator every 300 projects (3000 tasks)
        IF task_count % 3000 = 0 THEN
            RAISE NOTICE '  Generated % tasks...', task_count;
        END IF;
    END LOOP;

    RAISE NOTICE 'Completed: % tasks generated!', task_count;
END $$;

-- ============================================================================
-- BIG DATA VERIFICATION QUERIES
-- ============================================================================

-- Summary counts
SELECT 'Summary' as section, '' as metric, '' as value
UNION ALL
SELECT '', 'Businesses (generated)', COUNT(*)::text FROM app.business WHERE metadata->>'generated' = 'true'
UNION ALL
SELECT '', 'Projects (generated)', COUNT(*)::text FROM app.project WHERE metadata->>'generated' = 'true'
UNION ALL
SELECT '', 'Tasks (generated)', COUNT(*)::text FROM app.task WHERE metadata->>'generated' = 'true';

-- Ratio verification
SELECT
    'Ratio Check' as check_type,
    (SELECT COUNT(*) FROM app.business WHERE metadata->>'batch' = 'big_data_300') as businesses,
    (SELECT COUNT(*) FROM app.project WHERE metadata->>'batch' = 'big_data_3000') as projects,
    (SELECT COUNT(*) FROM app.task WHERE metadata->>'batch' = 'big_data_30000') as tasks,
    ROUND((SELECT COUNT(*)::numeric FROM app.project WHERE metadata->>'batch' = 'big_data_3000') /
          NULLIF((SELECT COUNT(*) FROM app.business WHERE metadata->>'batch' = 'big_data_300'), 0), 1) as "projects_per_business",
    ROUND((SELECT COUNT(*)::numeric FROM app.task WHERE metadata->>'batch' = 'big_data_30000') /
          NULLIF((SELECT COUNT(*) FROM app.project WHERE metadata->>'batch' = 'big_data_3000'), 0), 1) as "tasks_per_project";

-- Distribution by service category
SELECT 'Service Category Distribution' as report;
SELECT
    metadata->>'service_category' as service_category,
    COUNT(*) as business_count
FROM app.business
WHERE metadata->>'batch' = 'big_data_300'
GROUP BY metadata->>'service_category'
ORDER BY business_count DESC;

-- Distribution by project stage
SELECT 'Project Stage Distribution' as report;
SELECT
    dl__project_stage,
    COUNT(*) as project_count
FROM app.project
WHERE metadata->>'batch' = 'big_data_3000'
GROUP BY dl__project_stage
ORDER BY project_count DESC;

-- Distribution by task stage
SELECT 'Task Stage Distribution' as report;
SELECT
    dl__task_stage,
    COUNT(*) as task_count
FROM app.task
WHERE metadata->>'batch' = 'big_data_30000'
GROUP BY dl__task_stage
ORDER BY task_count DESC;

-- Distribution by task priority
SELECT 'Task Priority Distribution' as report;
SELECT
    dl__task_priority,
    COUNT(*) as task_count
FROM app.task
WHERE metadata->>'batch' = 'big_data_30000'
GROUP BY dl__task_priority
ORDER BY task_count DESC;

-- Office distribution
SELECT 'Office Distribution' as report;
SELECT
    o.name as office_name,
    COUNT(b.id) as business_count
FROM app.business b
LEFT JOIN app.office o ON b.office_id = o.id
WHERE b.metadata->>'batch' = 'big_data_300'
GROUP BY o.name
ORDER BY business_count DESC;

-- Total counts (including seed data)
SELECT 'Total Records (including seed data)' as report;
SELECT 'Businesses' as entity, COUNT(*) as total FROM app.business WHERE active_flag = true
UNION ALL
SELECT 'Projects' as entity, COUNT(*) as total FROM app.project WHERE active_flag = true
UNION ALL
SELECT 'Tasks' as entity, COUNT(*) as total FROM app.task WHERE active_flag = true;


-- ############################################################################
-- SECTION 3: RBAC SEED DATA - ROLE-BASED PERMISSIONS (v2.1.0)
-- ############################################################################
--
-- ARCHITECTURE (v2.1.0 Role-Only Model):
-- Permissions are granted to ROLES only (no direct employee/person permissions).
-- Persons get permissions through role membership via entity_instance_link.
--
-- TABLE STRUCTURE (app.entity_rbac):
--   role_id:            UUID FK to app.role - the role receiving permission
--   entity_code:        Entity type code (e.g., 'project', 'task')
--   entity_instance_id: Specific instance UUID, or ALL_ENTITIES_ID for type-level
--   permission:         0-7 (VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER)
--   inheritance_mode:   'none', 'cascade', 'mapped'
--   child_permissions:  JSONB mapping child entity codes to permission levels
--   is_deny:            Explicit deny (blocks permission even if granted elsewhere)
--
-- PERMISSION LEVEL MODEL (0-7):
--   0 = VIEW:       Read-only access to entity data
--   1 = COMMENT:    VIEW + add comments on entities
--   2 = CONTRIBUTE: COMMENT + form submission, task updates
--   3 = EDIT:       CONTRIBUTE + modify existing entity fields
--   4 = SHARE:      EDIT + share entity with others
--   5 = DELETE:     SHARE + soft delete entity
--   6 = CREATE:     DELETE + create new entities
--   7 = OWNER:      Full control including permission management
--
-- INHERITANCE MODES:
--   none:    Permission applies ONLY to the specific entity (no children inherit)
--   cascade: Same permission level applies to ALL children (recursive)
--   mapped:  Different permission levels per child entity type (via child_permissions JSONB)
--            Uses "_default" key for unlisted child types
--
-- ALL_ENTITIES_ID: '11111111-1111-1111-1111-111111111111'
--   Used for TYPE-LEVEL permissions (applies to all instances of an entity type)
--
-- ROLE HIERARCHY (22 roles organized by responsibility):
--   EXECUTIVE:   CEO, CFO, COO, CTO, SVP
--   DIRECTOR:    DIR-FIN, DIR-IT, VP-HR
--   MANAGER:     MGR-LAND, MGR-SNOW, MGR-HVAC, MGR-PLUMB, MGR-SOLAR
--   SUPERVISOR:  SUP-FIELD
--   SPECIALIST:  TECH-SR, TECH-FIELD, ADMIN-IT, ANALYST-FIN
--   COORDINATOR: COORD-PROJ, COORD-HR
--   LIMITED:     PT-SUPPORT, SEASONAL
-- ============================================================================

-- Clear existing RBAC data for clean re-import
DELETE FROM app.entity_rbac;

-- ============================================================================
-- 3.1 EXECUTIVE TIER: CEO, CFO, COO, CTO, SVP
-- ============================================================================
-- Full ownership with cascade inheritance for all entity types
-- Business rationale: Executives need complete visibility and control

-- CEO - Full OWNER on everything with cascade (ultimate authority)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  7,  -- OWNER
  'cascade',
  '{}'::jsonb,
  false,
  now()
FROM app.role r
CROSS JOIN (VALUES
  ('office'), ('business'), ('project'), ('task'), ('customer'), ('employee'),
  ('role'), ('form'), ('wiki'), ('artifact'), ('expense'), ('revenue'),
  ('quote'), ('order'), ('invoice'), ('work_order'), ('event'), ('interaction'),
  ('calendar'), ('inventory'), ('service'), ('product'), ('supplier'), ('worksite'),
  ('workflow'), ('message'), ('shipment'), ('person')
) AS entities(entity_type)
WHERE r.code = 'CEO';

-- CFO - OWNER on financial entities, CREATE on operational with financial visibility
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'CFO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"expense": 7, "revenue": 7, "invoice": 7, "_default": 3}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('business')) AS entities(entity_type)
WHERE r.code = 'CFO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('customer'), ('supplier')) AS entities(entity_type)
WHERE r.code = 'CFO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('task'), ('wiki'), ('artifact'), ('form')) AS entities(entity_type)
WHERE r.code = 'CFO';

-- COO - OWNER on operations, CREATE on projects with mapped child permissions
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task'), ('work_order'), ('workflow')) AS entities(entity_type)
WHERE r.code = 'COO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"project": 7, "expense": 3, "revenue": 0, "_default": 4}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('business'), ('customer')) AS entities(entity_type)
WHERE r.code = 'COO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('worksite'), ('inventory'), ('service'), ('product')) AS entities(entity_type)
WHERE r.code = 'COO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('quote'), ('order'), ('invoice')) AS entities(entity_type)
WHERE r.code = 'COO';

-- CTO - OWNER on IT/tech entities, full control on wikis and workflows
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('wiki'), ('workflow'), ('form'), ('message')) AS entities(entity_type)
WHERE r.code = 'CTO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"wiki": 7, "form": 7, "artifact": 5, "_default": 3}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task')) AS entities(entity_type)
WHERE r.code = 'CTO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('artifact'), ('service'), ('product')) AS entities(entity_type)
WHERE r.code = 'CTO';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote')) AS entities(entity_type)
WHERE r.code = 'CTO';

-- SVP - Similar to COO but with slightly reduced financial access
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task'), ('work_order')) AS entities(entity_type)
WHERE r.code = 'SVP';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'mapped',
  '{"project": 6, "task": 5, "_default": 3}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('business'), ('customer')) AS entities(entity_type)
WHERE r.code = 'SVP';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('wiki'), ('artifact'), ('form'), ('event'), ('calendar')) AS entities(entity_type)
WHERE r.code = 'SVP';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'SVP';

-- ============================================================================
-- 3.2 DIRECTOR TIER: DIR-FIN, DIR-IT, VP-HR
-- ============================================================================
-- Directors have broad access within their domain with some cross-functional visibility

-- DIR-FIN - Finance Director: Full control of financial entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'DIR-FIN';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'mapped',
  '{"expense": 7, "revenue": 7, "_default": 3}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('business'), ('customer')) AS entities(entity_type)
WHERE r.code = 'DIR-FIN';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('supplier')) AS entities(entity_type)
WHERE r.code = 'DIR-FIN';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('task'), ('wiki'), ('form'), ('artifact')) AS entities(entity_type)
WHERE r.code = 'DIR-FIN';

-- DIR-IT - IT Director: Full control of technical/documentation entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('wiki'), ('form'), ('workflow'), ('message')) AS entities(entity_type)
WHERE r.code = 'DIR-IT';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"wiki": 7, "form": 7, "artifact": 6, "_default": 3}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task')) AS entities(entity_type)
WHERE r.code = 'DIR-IT';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('artifact')) AS entities(entity_type)
WHERE r.code = 'DIR-IT';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('service'), ('product'), ('inventory')) AS entities(entity_type)
WHERE r.code = 'DIR-IT';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote')) AS entities(entity_type)
WHERE r.code = 'DIR-IT';

-- VP-HR - VP of Human Resources: Full control of employee/person data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('person'), ('role'), ('calendar')) AS entities(entity_type)
WHERE r.code = 'VP-HR';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('event'), ('interaction')) AS entities(entity_type)
WHERE r.code = 'VP-HR';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('form'), ('wiki'), ('artifact')) AS entities(entity_type)
WHERE r.code = 'VP-HR';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('office'), ('business')) AS entities(entity_type)
WHERE r.code = 'VP-HR';

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task'), ('expense'), ('revenue')) AS entities(entity_type)
WHERE r.code = 'VP-HR';

-- ============================================================================
-- 3.3 MANAGER TIER: MGR-LAND, MGR-SNOW, MGR-HVAC, MGR-PLUMB, MGR-SOLAR
-- ============================================================================
-- Department managers: Create projects with mapped inheritance for granular child control
-- Business rationale: Managers need to create and manage projects within their domain

-- All Department Managers - Project management with mapped child permissions
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 6, "wiki": 5, "artifact": 4, "form": 4, "expense": 3, "revenue": 0, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Task management with subtask creation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 6, "form": 4, "artifact": 4, "expense": 2, "revenue": 0, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Work order management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('work_order'), ('quote')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Documentation and resource management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('wiki'), ('artifact'), ('form')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Customer and worksite access
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'mapped',
  '{"project": 5, "artifact": 3, "_default": 2}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('customer'), ('worksite')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Team management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('calendar'), ('event'), ('interaction')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Inventory and service management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('inventory'), ('service'), ('product'), ('supplier')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Expense entry (own department)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'expense', '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- All Department Managers - Financial visibility (read-only)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('revenue'), ('invoice'), ('order')) AS entities(entity_type)
WHERE r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- ============================================================================
-- 3.4 SUPERVISOR TIER: SUP-FIELD
-- ============================================================================
-- Field Supervisors: Leads field teams, manages task execution, limited project visibility
-- Business rationale: Needs to create tasks, manage field work, but projects are manager-level

-- Field Supervisor - Task management with full child control
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 6, "form": 4, "artifact": 4, "expense": 2, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Work order ownership
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'work_order', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Project participation (share child tasks but can't create projects)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111'::uuid, 4, 'mapped',
  '{"task": 6, "wiki": 3, "artifact": 4, "form": 4, "expense": 2, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Documentation management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('artifact'), ('form')) AS entities(entity_type)
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Wiki editing
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'wiki', '11111111-1111-1111-1111-111111111111'::uuid, 4, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Customer and worksite access
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('customer'), ('worksite'), ('interaction')) AS entities(entity_type)
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Team coordination
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('calendar'), ('event')) AS entities(entity_type)
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Resource visibility
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('inventory'), ('service'), ('product'), ('expense')) AS entities(entity_type)
WHERE r.code = 'SUP-FIELD';

-- Field Supervisor - Financial read-only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'SUP-FIELD';

-- ============================================================================
-- 3.5 SPECIALIST TIER: TECH-SR, TECH-FIELD, ADMIN-IT, ANALYST-FIN
-- ============================================================================
-- Specialists: Domain experts with focused access to their area of expertise

-- TECH-SR (Senior Technician) - Task ownership with subtask creation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 5, "form": 3, "artifact": 3, "_default": 1}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'TECH-SR';

-- TECH-SR - Work order management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'work_order', '11111111-1111-1111-1111-111111111111'::uuid, 5, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'TECH-SR';

-- TECH-SR - Documentation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('artifact'), ('form'), ('wiki')) AS entities(entity_type)
WHERE r.code = 'TECH-SR';

-- TECH-SR - Project contribution
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'mapped',
  '{"task": 5, "artifact": 3, "_default": 1}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'TECH-SR';

-- TECH-SR - Field resources
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('customer'), ('worksite'), ('inventory'), ('service'), ('product')) AS entities(entity_type)
WHERE r.code = 'TECH-SR';

-- TECH-SR - View scheduling
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('calendar'), ('event'), ('expense'), ('quote')) AS entities(entity_type)
WHERE r.code = 'TECH-SR';

-- TECH-FIELD (Field Technician) - Task execution only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 3, 'mapped',
  '{"form": 2, "artifact": 2, "_default": 0}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'TECH-FIELD';

-- TECH-FIELD - Form submission and artifact upload
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('form'), ('artifact'), ('work_order')) AS entities(entity_type)
WHERE r.code = 'TECH-FIELD';

-- TECH-FIELD - Reference data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('customer'), ('worksite'), ('inventory'), ('service'), ('product'), ('wiki'), ('calendar')) AS entities(entity_type)
WHERE r.code = 'TECH-FIELD';

-- ADMIN-IT (IT Administrator) - Full IT system control
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 7, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('wiki'), ('form'), ('workflow'), ('message')) AS entities(entity_type)
WHERE r.code = 'ADMIN-IT';

-- ADMIN-IT - Project documentation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'mapped',
  '{"wiki": 7, "form": 7, "artifact": 5, "_default": 2}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task')) AS entities(entity_type)
WHERE r.code = 'ADMIN-IT';

-- ADMIN-IT - Artifact management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'artifact', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'ADMIN-IT';

-- ADMIN-IT - User and role management view
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('role'), ('person')) AS entities(entity_type)
WHERE r.code = 'ADMIN-IT';

-- ADMIN-IT - View other entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('customer'), ('expense'), ('revenue'), ('invoice'), ('order')) AS entities(entity_type)
WHERE r.code = 'ADMIN-IT';

-- ANALYST-FIN (Financial Analyst) - Financial data analysis
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('expense'), ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'ANALYST-FIN';

-- ANALYST-FIN - Project financial access
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 2, 'mapped',
  '{"expense": 4, "revenue": 4, "_default": 0}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('business'), ('customer')) AS entities(entity_type)
WHERE r.code = 'ANALYST-FIN';

-- ANALYST-FIN - View operational data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('task'), ('employee'), ('supplier'), ('inventory')) AS entities(entity_type)
WHERE r.code = 'ANALYST-FIN';

-- ============================================================================
-- 3.6 COORDINATOR TIER: COORD-PROJ, COORD-HR
-- ============================================================================
-- Coordinators: Administrative support with broad but shallow access

-- COORD-PROJ (Project Coordinator) - Full project coordination
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 4, "wiki": 4, "artifact": 3, "form": 4, "expense": 2, "revenue": 0, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Task management for coordination
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 6, 'mapped',
  '{"task": 5, "form": 4, "artifact": 3, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Event and calendar management (scheduling)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('event'), ('calendar'), ('interaction')) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Documentation management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('wiki'), ('artifact'), ('form')) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Customer communication
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'customer', '11111111-1111-1111-1111-111111111111'::uuid, 4, 'mapped',
  '{"project": 5, "artifact": 3, "_default": 2}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Team visibility
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 3, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('work_order'), ('message')) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Expense tracking
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'expense', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- COORD-PROJ - Financial view only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('revenue'), ('invoice'), ('quote'), ('order')) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- COORD-HR (HR Coordinator) - Employee management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 5, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('employee'), ('person'), ('calendar')) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- COORD-HR - Event and interaction management
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 6, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('event'), ('interaction')) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- COORD-HR - HR documentation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 4, 'cascade', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('form'), ('wiki'), ('artifact')) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- COORD-HR - Organizational view
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('office'), ('business'), ('role')) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- COORD-HR - View projects and tasks (no modification)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('task'), ('customer'), ('expense'), ('revenue')) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- ============================================================================
-- 3.7 LIMITED TIER: PT-SUPPORT, SEASONAL
-- ============================================================================
-- Limited access roles: Contractors, temps, part-timers with restricted permissions

-- PT-SUPPORT (Part-time Support) - Basic task execution
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'mapped',
  '{"form": 2, "artifact": 1, "_default": 0}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'PT-SUPPORT';

-- PT-SUPPORT - Form filling
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'form', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'PT-SUPPORT';

-- PT-SUPPORT - View only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('customer'), ('worksite'), ('wiki'), ('artifact'), ('calendar')) AS entities(entity_type)
WHERE r.code = 'PT-SUPPORT';

-- SEASONAL (Seasonal Worker) - Minimal task participation
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'task', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'mapped',
  '{"form": 2, "artifact": 1, "_default": 0}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SEASONAL';

-- SEASONAL - Form submission only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, 'form', '11111111-1111-1111-1111-111111111111'::uuid, 2, 'none', '{}'::jsonb, false, now()
FROM app.role r
WHERE r.code = 'SEASONAL';

-- SEASONAL - View reference data only
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT r.id, entity_type, '11111111-1111-1111-1111-111111111111'::uuid, 0, 'none', '{}'::jsonb, false, now()
FROM app.role r
CROSS JOIN (VALUES ('project'), ('customer'), ('worksite'), ('wiki'), ('calendar'), ('inventory')) AS entities(entity_type)
WHERE r.code = 'SEASONAL';

-- ============================================================================
-- 3.8 INSTANCE-LEVEL PERMISSIONS (Sample Project Assignments)
-- ============================================================================
-- Demonstrate instance-level permissions with mapped child permissions
-- These show how specific project assignments override type-level defaults

-- Sample: Assign COORD-PROJ higher access on specific high-priority projects
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  'project',
  p.id,
  5,  -- DELETE (higher than type-level CREATE)
  'mapped',
  '{"task": 6, "wiki": 5, "artifact": 5, "form": 5, "expense": 4, "revenue": 2, "_default": 3}'::jsonb,
  false,
  now()
FROM app.role r
CROSS JOIN (
  SELECT id FROM app.project WHERE active_flag = true ORDER BY created_ts DESC LIMIT 5
) p
WHERE r.code = 'COORD-PROJ';

-- Sample: Give TECH-SR OWNER on specific tasks they're responsible for
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  'task',
  t.id,
  7,  -- OWNER
  'cascade',
  '{}'::jsonb,
  false,
  now()
FROM app.role r
CROSS JOIN (
  SELECT id FROM app.task WHERE active_flag = true ORDER BY RANDOM() LIMIT 10
) t
WHERE r.code = 'TECH-SR';

-- Sample: Give ANALYST-FIN elevated access on specific customer accounts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  'customer',
  c.entity_instance_id,
  5,  -- DELETE (elevated)
  'mapped',
  '{"expense": 6, "revenue": 6, "project": 3, "_default": 2}'::jsonb,
  false,
  now()
FROM app.role r
CROSS JOIN (
  SELECT entity_instance_id FROM app.entity_instance WHERE entity_code = 'customer' LIMIT 3
) c
WHERE r.code = 'ANALYST-FIN';

-- ============================================================================
-- 3.9 ROLE-PERSON MEMBERSHIP LINKS
-- ============================================================================
-- Link persons to roles via entity_instance_link
-- This establishes the role membership that RBAC resolution uses

-- CEO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CEO' AND p.email = 'james.miller@huronhome.ca' AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- COO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'COO' AND p.email = 'sarah.johnson@huronhome.ca' AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- CTO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CTO' AND p.email = 'michael.chen@huronhome.ca' AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3.10 ENTITY INSTANCE LINKS (HIERARCHIES)
-- ============================================================================
-- Create parent-child relationships for entity navigation

-- Link projects to tasks (project → task) - ~10 tasks per project
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT DISTINCT 'project', p.id, 'task', t.id, 'contains'
FROM (SELECT id, row_number() OVER (ORDER BY id) as proj_num FROM app.project WHERE active_flag = true) p
CROSS JOIN (SELECT id, row_number() OVER (ORDER BY id) as task_num FROM app.task WHERE active_flag = true) t
WHERE (t.task_num / 10 = p.proj_num) OR (t.task_num % 3005 = p.proj_num - 1)
ON CONFLICT DO NOTHING;

-- Link businesses to projects (business → project)
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT DISTINCT 'business', b.id, 'project', p.id, 'owns'
FROM (SELECT id, row_number() OVER (ORDER BY id) as biz_num FROM app.business WHERE active_flag = true) b
CROSS JOIN (SELECT id, row_number() OVER (ORDER BY id) as proj_num FROM app.project WHERE active_flag = true) p
WHERE p.proj_num % 306 = b.biz_num - 1
ON CONFLICT DO NOTHING;

-- Link employees to tasks (employee → task) - assignments
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT DISTINCT 'employee', e.id, 'task', t.id, 'assigned_to'
FROM (SELECT id, row_number() OVER (ORDER BY id) as emp_num FROM app.employee WHERE active_flag = true LIMIT 500) e
CROSS JOIN (SELECT id, row_number() OVER (ORDER BY id) as task_num FROM app.task WHERE active_flag = true) t
WHERE t.task_num % 500 = e.emp_num - 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3.11 RBAC VERIFICATION QUERIES
-- ============================================================================

SELECT 'RBAC Summary by Role Tier' as report;
SELECT
    CASE
        WHEN r.code IN ('CEO', 'CFO', 'COO', 'CTO', 'SVP') THEN 'Executive'
        WHEN r.code IN ('DIR-FIN', 'DIR-IT', 'VP-HR') THEN 'Director'
        WHEN r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR') THEN 'Manager'
        WHEN r.code = 'SUP-FIELD' THEN 'Supervisor'
        WHEN r.code IN ('TECH-SR', 'TECH-FIELD', 'ADMIN-IT', 'ANALYST-FIN') THEN 'Specialist'
        WHEN r.code IN ('COORD-PROJ', 'COORD-HR') THEN 'Coordinator'
        WHEN r.code IN ('PT-SUPPORT', 'SEASONAL') THEN 'Limited'
        ELSE 'Other'
    END as tier,
    COUNT(DISTINCT r.id) as roles,
    COUNT(er.id) as total_permissions,
    COUNT(DISTINCT er.entity_code) as entity_types,
    SUM(CASE WHEN er.inheritance_mode = 'cascade' THEN 1 ELSE 0 END) as cascade_perms,
    SUM(CASE WHEN er.inheritance_mode = 'mapped' THEN 1 ELSE 0 END) as mapped_perms
FROM app.role r
LEFT JOIN app.entity_rbac er ON r.id = er.role_id
WHERE r.active_flag = true
GROUP BY
    CASE
        WHEN r.code IN ('CEO', 'CFO', 'COO', 'CTO', 'SVP') THEN 'Executive'
        WHEN r.code IN ('DIR-FIN', 'DIR-IT', 'VP-HR') THEN 'Director'
        WHEN r.code IN ('MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR') THEN 'Manager'
        WHEN r.code = 'SUP-FIELD' THEN 'Supervisor'
        WHEN r.code IN ('TECH-SR', 'TECH-FIELD', 'ADMIN-IT', 'ANALYST-FIN') THEN 'Specialist'
        WHEN r.code IN ('COORD-PROJ', 'COORD-HR') THEN 'Coordinator'
        WHEN r.code IN ('PT-SUPPORT', 'SEASONAL') THEN 'Limited'
        ELSE 'Other'
    END
ORDER BY
    CASE
        WHEN r.code IN ('CEO', 'CFO', 'COO', 'CTO', 'SVP') THEN 1
        WHEN r.code IN ('DIR-FIN', 'DIR-IT', 'VP-HR') THEN 2
        ELSE 3
    END;

SELECT 'Permission Distribution by Level' as report;
SELECT
    er.permission,
    CASE er.permission
        WHEN 0 THEN 'VIEW'
        WHEN 1 THEN 'COMMENT'
        WHEN 2 THEN 'CONTRIBUTE'
        WHEN 3 THEN 'EDIT'
        WHEN 4 THEN 'SHARE'
        WHEN 5 THEN 'DELETE'
        WHEN 6 THEN 'CREATE'
        WHEN 7 THEN 'OWNER'
    END as permission_name,
    COUNT(*) as count,
    COUNT(DISTINCT er.role_id) as roles_with_perm,
    COUNT(DISTINCT er.entity_code) as entity_types
FROM app.entity_rbac er
GROUP BY er.permission
ORDER BY er.permission;

SELECT 'Mapped Child Permissions Examples' as report;
SELECT
    r.code as role_code,
    er.entity_code,
    er.permission,
    er.inheritance_mode,
    er.child_permissions
FROM app.entity_rbac er
JOIN app.role r ON er.role_id = r.id
WHERE er.inheritance_mode = 'mapped'
  AND er.child_permissions != '{}'::jsonb
  AND er.entity_instance_id = '11111111-1111-1111-1111-111111111111'
ORDER BY r.code, er.entity_code
LIMIT 20;

SELECT 'Entity Instance Link Summary' as report;
SELECT
    entity_code || ' → ' || child_entity_code as relationship,
    COUNT(*) as link_count
FROM app.entity_instance_link
GROUP BY entity_code, child_entity_code
ORDER BY link_count DESC
LIMIT 15;

-- Update table comment
COMMENT ON TABLE app.entity_rbac IS 'Role-based RBAC system (v2.1.0). Permissions granted to roles only via role_id FK. Persons get permissions through role membership via entity_instance_link. Inheritance modes: none, cascade, mapped. Child permissions via JSONB. SEED DATA LOADED from big_data.sql';


-- ############################################################################
-- SECTION 4: ENTITY INFRASTRUCTURE INDEXES
-- ############################################################################
-- Performance indexes for entity_instance, entity_instance_link, entity_rbac,
-- and entity tables based on query patterns in entity-infrastructure.service.ts
--
-- QUERY PATTERNS OPTIMIZED:
--   1. entity_instance lookups by (entity_code, entity_instance_id)
--   2. entity_instance_link parent→child and child→parent queries
--   3. entity_rbac permission checks (employee + role inheritance)
--   4. entity JSONB child_entity_codes containment queries
--
-- DATA VOLUMES (as of big_data.sql):
--   - entity_instance: ~34K records
--   - entity_instance_link: ~156K records
--   - entity_rbac: ~200K records
--   - entity: ~50 records
--
-- ============================================================================

-- ============================================================================
-- SECTION 4.1: entity_instance INDEXES
-- ============================================================================
-- Used by: validate_entity_instance_registry(), getEntityInstanceNames(),
--          getAllEntityInstanceNames(), set_entity_instance_registry()

-- Primary lookup pattern: (entity_code, entity_instance_id) - used in ~15 methods
-- CRITICAL: This is the most frequently hit pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_instance_code_id
ON app.entity_instance (entity_code, entity_instance_id);

-- Name lookups for dropdowns and search (getAllEntityInstanceNames)
-- ORDER BY entity_instance_name ASC
CREATE INDEX IF NOT EXISTS idx_entity_instance_code_name
ON app.entity_instance (entity_code, entity_instance_name);

-- Entity code only (for getEntityInstances grouped query)
CREATE INDEX IF NOT EXISTS idx_entity_instance_entity_code
ON app.entity_instance (entity_code);

-- ============================================================================
-- SECTION 4.2: entity_instance_link INDEXES
-- ============================================================================
-- Used by: get_entity_instance_link_children(), getAccessibleEntityIds(),
--          delete_entity(), role membership queries in RBAC CTEs

-- Parent → Child lookups (most common pattern)
-- Query: WHERE entity_code = X AND entity_instance_id = Y AND child_entity_code = Z
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_parent
ON app.entity_instance_link (entity_code, entity_instance_id, child_entity_code);

-- Child → Parent lookups (for delete cascades and reverse navigation)
-- Query: WHERE child_entity_code = X AND child_entity_instance_id = Y
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_child
ON app.entity_instance_link (child_entity_code, child_entity_instance_id);

-- Role → Person membership (heavily used in RBAC CTEs per RBAC v2.0.0)
-- Query: WHERE entity_code = 'role' AND child_entity_code = 'person' AND child_entity_instance_id = ?
-- Partial index for this specific high-frequency pattern
CREATE INDEX IF NOT EXISTS idx_entity_instance_link_role_person
ON app.entity_instance_link (entity_instance_id, child_entity_instance_id)
WHERE entity_code = 'role' AND child_entity_code = 'person';

-- Unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_instance_link_unique
ON app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id);

-- ============================================================================
-- SECTION 4.3: entity_rbac INDEXES (v2.0.0 Role-Only Model)
-- ============================================================================
-- Used by: check_entity_rbac(), getMaxPermissionLevel(), getAccessibleEntityIds(),
--          delete_entity(), set_entity_rbac()
--
-- NOTE: Primary indexes defined in 06_entity_rbac.ddl:
--   - idx_entity_rbac_unique_permission: (role_id, entity_code, entity_instance_id) UNIQUE
--   - idx_entity_rbac_role_entity: (role_id, entity_code)
--   - idx_entity_rbac_entity_instance: (entity_code, entity_instance_id)
--   - idx_entity_rbac_deny: (role_id, entity_code, entity_instance_id) WHERE is_deny = true
--   - idx_entity_rbac_inheritable: (role_id, inheritance_mode) WHERE inheritance_mode IN ('cascade', 'mapped')
--   - idx_entity_rbac_expires: (expires_ts) WHERE expires_ts IS NOT NULL
--
-- Additional indexes for big_data performance (if needed):

-- Active (non-expired) permission lookups for role-based queries
-- Query: WHERE role_id IN (...) AND entity_code = ? AND (expires_ts IS NULL OR expires_ts > NOW())
CREATE INDEX IF NOT EXISTS idx_entity_rbac_active_permissions
ON app.entity_rbac (role_id, entity_code, entity_instance_id, permission)
WHERE expires_ts IS NULL;

-- ============================================================================
-- SECTION 4.4: entity TABLE INDEXES
-- ============================================================================
-- Used by: get_parent_entity_codes(), get_entity(), get_all_entity()
--
-- NOTE: entity_pkey (code) already exists as primary key

-- JSONB containment queries for child_entity_codes
-- Query: WHERE child_entity_codes @> '["task"]'::jsonb
-- GIN index for efficient JSONB containment operations
CREATE INDEX IF NOT EXISTS idx_entity_child_codes_gin
ON app.entity USING GIN (child_entity_codes jsonb_path_ops);

-- Active entities filter (used in most entity queries)
-- Query: WHERE active_flag = true ORDER BY display_order
CREATE INDEX IF NOT EXISTS idx_entity_active_order
ON app.entity (display_order, code)
WHERE active_flag = true;

-- ============================================================================
-- VERIFY INDEX CREATION
-- ============================================================================

DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'app'
    AND tablename IN ('entity', 'entity_instance', 'entity_instance_link', 'entity_rbac');

  RAISE NOTICE '============================================';
  RAISE NOTICE 'ENTITY INFRASTRUCTURE INDEXES CREATED';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total indexes on infrastructure tables: %', idx_count;
  RAISE NOTICE '============================================';
END $$;


-- ############################################################################
-- CLEANUP SCRIPT (run if needed to remove generated data)
-- ############################################################################
--
-- To remove ONLY the big data (keep seed data):
--
-- DELETE FROM app.task WHERE metadata->>'batch' = 'big_data_30000';
-- DELETE FROM app.project WHERE metadata->>'batch' = 'big_data_3000';
-- DELETE FROM app.business WHERE metadata->>'batch' = 'big_data_300';
--
-- To remove RBAC and links (if regenerating):
--
-- DELETE FROM app.entity_rbac WHERE person_code = 'employee';
-- DELETE FROM app.entity_instance_link WHERE relationship_type IN ('contains', 'owns', 'assigned_to', 'member_of', 'employs', 'location_of');
--
-- ============================================================================
