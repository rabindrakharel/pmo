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
-- SECTION 3: RBAC SEED DATA - ROLE-BASED PERMISSIONS (v2.0.0)
-- ############################################################################
--
-- ARCHITECTURE (v2.0.0 Role-Only Model):
-- Permissions are granted to ROLES only (no direct employee/person permissions).
-- Persons get permissions through role membership via entity_instance_link.
--
-- PERMISSION LEVEL MODEL (0-7):
--   0 = View:       Read access to entity data
--   1 = Comment:    Add comments on entities
--   2 = Contribute: Form submission, task updates, wiki edits
--   3 = Edit:       Modify existing entity fields
--   4 = Share:      Share entity with others
--   5 = Delete:     Soft delete entity
--   6 = Create:     Create new entities (type-level only)
--   7 = Owner:      Full control including permission management
--
-- INHERITANCE MODES:
--   none:    Permission applies ONLY to the specific entity (no children inherit)
--   cascade: Same permission level applies to ALL children (recursive)
--   mapped:  Different permission levels per child entity type (via child_permissions JSONB)
-- ============================================================================

-- Clear existing RBAC data for clean re-import
DELETE FROM app.entity_rbac;

-- ============================================================================
-- CEO ROLE - FULL OWNERSHIP (LEVEL 7) WITH CASCADE INHERITANCE
-- ============================================================================
-- CEO role gets Owner (7) permission on ALL entities with cascade inheritance
-- This means all child entities automatically inherit Owner permission

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  7,  -- Owner
  'cascade',  -- All children inherit same permission
  '{}'::jsonb,
  false,
  now()
FROM app.role r
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('customer'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('revenue'), ('role'), ('service'),
  ('shipment'), ('task'), ('wiki'), ('workflow'), ('workflow_automation'),
  ('work_order'), ('worksite'), ('person')
) AS entities(entity_type)
WHERE r.code = 'CEO';

-- ============================================================================
-- MANAGER ROLES - DEPARTMENT LEADERSHIP PERMISSIONS
-- ============================================================================
-- Department managers can create projects and tasks, with cascade inheritance
-- Child entities inherit the same permission level

-- Managers - Create projects with cascade to child entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',  -- Children (tasks, artifacts) inherit Create permission
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('work_order'), ('quote')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Create tasks with mapped inheritance (tasks can contain subtasks, forms)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'task',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'mapped',  -- Different permissions for different child types
  '{"task": 6, "form": 3, "artifact": 3, "_default": 0}'::jsonb,  -- subtasks: Create, forms/artifacts: Edit
  false
FROM app.role r
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Delete permissions on operational entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',  -- Delete permission doesn't cascade automatically
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Share resources and operational data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',  -- Can share child entities too
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('customer'), ('form'), ('inventory'), ('service'), ('product')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Edit employee records and schedules
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',  -- No inheritance for personnel records
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('calendar'), ('event')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - View financial data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- ============================================================================
-- SUPERVISOR ROLES - FIELD OPERATIONS LEADERSHIP
-- ============================================================================

-- Supervisors - Create tasks
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'task',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Delete operational artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'artifact',
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Share customer and worksite information
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('customer'), ('interaction')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Edit work orders and forms
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('work_order'), ('form'), ('wiki'), ('event')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Comment on projects
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'project',
  '11111111-1111-1111-1111-111111111111'::uuid,
  1,  -- Comment
  'none',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - View inventory and products
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- ============================================================================
-- TECHNICIAN ROLES - FIELD OPERATIONS EXECUTION
-- ============================================================================

-- Technicians - Edit tasks, forms, and work orders
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('form'), ('work_order'), ('interaction')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- Technicians - Comment on projects and artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  1,  -- Comment
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- Technicians - View customers, worksites, and inventory
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('customer'), ('worksite'), ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- ============================================================================
-- COORDINATOR ROLES - ADMINISTRATIVE SUPPORT
-- ============================================================================

-- ============================================================================
-- PROJECT COORDINATOR (COORD-PROJ) - Specialized for project management
-- Role: scheduling, communication, documentation, and administrative support
-- ============================================================================

-- Project Coordinator - Project access with MAPPED inheritance
-- Share projects but granular control over child entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'project',
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'mapped',
  '{"task": 3, "wiki": 3, "artifact": 2, "form": 3, "expense": 0, "revenue": 0, "_default": 0}'::jsonb,
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Create tasks with mapped inheritance for subtasks
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'task',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'mapped',
  '{"task": 6, "form": 3, "artifact": 2, "_default": 0}'::jsonb,  -- subtasks: Create, forms: Edit, artifacts: Contribute
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Create events (scheduling responsibility)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'event',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Create interactions (stakeholder communication)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'interaction',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Manage calendar (scheduling)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'calendar',
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Delete forms and artifacts (documentation oversight)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('artifact')
) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Share wiki and customer (documentation & communication)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('wiki'), ('customer')
) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Edit employees and work orders (administrative support)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('work_order')
) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - Edit messages (communication responsibility)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'message',
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code = 'COORD-PROJ';

-- Project Coordinator - View financial data (read-only access for coordination)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('revenue'), ('invoice'), ('order'), ('quote')
) AS entities(entity_type)
WHERE r.code = 'COORD-PROJ';

-- ============================================================================
-- HR COORDINATOR (COORD-HR) - Specialized for HR operations
-- ============================================================================

-- HR Coordinator - Create tasks and events
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('event'), ('interaction')
) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- HR Coordinator - Delete forms and artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('artifact')
) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- HR Coordinator - Share projects, customers, wikis, calendar
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('customer'), ('wiki'), ('calendar')
) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- HR Coordinator - Edit employees and work orders
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('work_order')
) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- HR Coordinator - View financial data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.code = 'COORD-HR';

-- ============================================================================
-- CUSTOMER ROLE - LIMITED PERMISSIONS
-- ============================================================================
-- Customers get limited permissions via a CUSTOMER role (if exists)

-- Create customer role permissions (View only for their entities)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('task'), ('quote'), ('invoice')
) AS entities(entity_type)
WHERE r.code = 'CUSTOMER';

-- Customers can create interactions (submit forms, send messages)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('interaction')
) AS entities(entity_type)
WHERE r.code = 'CUSTOMER';

-- ============================================================================
-- ROLE-PERSON MEMBERSHIP LINKS
-- ============================================================================
-- Link persons to roles via entity_instance_link
-- This establishes the role membership that RBAC resolution uses

-- CEO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CEO'
  AND p.email = 'james.miller@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- COO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'COO'
  AND p.email = 'sarah.johnson@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- CTO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CTO'
  AND p.email = 'michael.chen@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3.4: TYPE-LEVEL CREATE PERMISSIONS FOR 500 EMPLOYEES
-- ============================================================================
-- Each employee gets CREATE (6) permission on ~8 random entity types
-- Uses efficient set-based SQL instead of loops

-- Create temp table for entity types
CREATE TEMP TABLE IF NOT EXISTS temp_entity_types AS
SELECT entity_type, row_number() OVER () as entity_num
FROM (VALUES
  ('project'), ('task'), ('work_order'), ('quote'), ('expense'),
  ('artifact'), ('wiki'), ('form'), ('interaction'), ('event'),
  ('calendar'), ('inventory'), ('customer'), ('worksite'), ('service'),
  ('product'), ('order'), ('invoice'), ('revenue'), ('shipment')
) AS entities(entity_type);

-- Grant CREATE permissions using set-based operation
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT DISTINCT
  'employee',
  e.id,
  t.entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- CREATE
  now()
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee
  WHERE active_flag = true
  LIMIT 500
) e
CROSS JOIN temp_entity_types t
WHERE (
  -- Deterministic "random" selection: ~8 entities per employee
  ((e.emp_num * 7 + t.entity_num * 13) % 20 < 8)
  OR t.entity_type = 'task'  -- Everyone can create tasks
)
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS temp_entity_types;

-- ============================================================================
-- STEP 3.5: INSTANCE-LEVEL PERMISSIONS ON PROJECTS
-- ============================================================================
-- Distribute ~3000 projects across 500 employees with varying permission levels
-- Uses efficient set-based SQL

-- VIEW permissions on projects (~6 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'project', p.id, 0, now()  -- VIEW
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  ((e.emp_num * 17 + p.proj_num * 31) % 1000 < 3)
  OR ((e.emp_num + p.proj_num) % 35 < 2)
)
ON CONFLICT DO NOTHING;

-- EDIT permissions on projects (~3 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'project', p.id, 3, now()  -- EDIT
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  ((e.emp_num * 17 + p.proj_num * 31) % 1000 >= 100)
  AND ((e.emp_num * 17 + p.proj_num * 31) % 1000 < 103)
)
ON CONFLICT DO NOTHING;

-- DELETE permissions on projects (~1-2 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'project', p.id, 5, now()  -- DELETE
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  ((e.emp_num * 17 + p.proj_num * 31) % 1000 >= 200)
  AND ((e.emp_num * 17 + p.proj_num * 31) % 1000 < 202)
)
ON CONFLICT DO NOTHING;

-- OWNER permissions on projects (~1 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'project', p.id, 7, now()  -- OWNER
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  p.proj_num = e.emp_num
  OR (e.emp_num * 6 = p.proj_num)
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3.6: INSTANCE-LEVEL PERMISSIONS ON TASKS
-- ============================================================================
-- Distribute 30K tasks across 500 employees

-- VIEW permissions on tasks (~160 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'task', t.id, 0, now()  -- VIEW
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as task_num
  FROM app.task WHERE active_flag = true
) t
WHERE (
  (t.task_num % 500 = e.emp_num - 1)
  OR ((t.task_num + e.emp_num) % 300 = 0)
)
ON CONFLICT DO NOTHING;

-- EDIT permissions on tasks (~30 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'task', t.id, 3, now()  -- EDIT
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as task_num
  FROM app.task WHERE active_flag = true
) t
WHERE (
  t.task_num % 1000 = e.emp_num - 1
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3.7: INSTANCE-LEVEL PERMISSIONS ON BUSINESSES
-- ============================================================================
-- Distribute 306 businesses across employees

-- VIEW permissions on businesses (~12 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'business', b.id, 0, now()  -- VIEW
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as biz_num
  FROM app.business WHERE active_flag = true
) b
WHERE (
  (e.emp_num + b.biz_num) % 25 < 3
)
ON CONFLICT DO NOTHING;

-- EDIT permissions on businesses (~3 per employee)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, 'business', b.id, 3, now()  -- EDIT
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as biz_num
  FROM app.business WHERE active_flag = true
) b
WHERE (
  (e.emp_num * 3 + b.biz_num) % 100 < 2
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3.8: GENERATE ENTITY INSTANCE LINKS (HIERARCHIES)
-- ============================================================================
-- Create parent-child relationships for entity navigation
-- Uses efficient set-based SQL

-- 3.8a: Link projects to tasks (project → task) - ~10 tasks per project
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'project', p.id, 'task', t.id, 'contains'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as task_num
  FROM app.task WHERE active_flag = true
) t
WHERE (
  (t.task_num / 10 = p.proj_num)
  OR (t.task_num % 3005 = p.proj_num - 1)
)
ON CONFLICT DO NOTHING;

-- 3.8b: Link businesses to projects (business → project) - ~10 projects per business
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'business', b.id, 'project', p.id, 'owns'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as biz_num
  FROM app.business WHERE active_flag = true
) b
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  p.proj_num % 306 = b.biz_num - 1
)
ON CONFLICT DO NOTHING;

-- 3.8c: Link employees to tasks (employee → task) - ~60 tasks per employee
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'employee', e.id, 'task', t.id, 'assigned_to'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as task_num
  FROM app.task WHERE active_flag = true
) t
WHERE (
  t.task_num % 500 = e.emp_num - 1
)
ON CONFLICT DO NOTHING;

-- 3.8d: Link employees to projects (employee → project) - ~120 projects per employee
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'employee', e.id, 'project', p.id, 'member_of'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  (e.emp_num + p.proj_num) % 50 < 2
)
ON CONFLICT DO NOTHING;

-- 3.8e: Link offices to employees - ~83 employees per office
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'office', o.id, 'employee', e.id, 'employs'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as office_num
  FROM app.office WHERE active_flag = true
) o
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as emp_num
  FROM app.employee WHERE active_flag = true LIMIT 500
) e
WHERE (
  e.emp_num % 6 = o.office_num - 1
)
ON CONFLICT DO NOTHING;

-- 3.8f: Link worksites to projects - ~500 projects per worksite
INSERT INTO app.entity_instance_link (
  entity_code, entity_instance_id,
  child_entity_code, child_entity_instance_id,
  relationship_type
)
SELECT DISTINCT
  'worksite', w.id, 'project', p.id, 'location_of'
FROM (
  SELECT id, row_number() OVER (ORDER BY id) as site_num
  FROM app.worksite WHERE active_flag = true
) w
CROSS JOIN (
  SELECT id, row_number() OVER (ORDER BY id) as proj_num
  FROM app.project WHERE active_flag = true
) p
WHERE (
  p.proj_num % 6 = w.site_num - 1
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3.9: UPDATE ENTITY INSTANCE REGISTRY
-- ============================================================================
-- Ensure all entities with RBAC permissions are registered in entity_instance
-- Note: entity_instance has no unique constraint, so we delete/insert

-- Delete existing generated entries first
DELETE FROM app.entity_instance WHERE entity_code IN ('project', 'task', 'business', 'employee');

-- Insert projects
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT DISTINCT 'project', p.id, p.name, p.code
FROM app.project p WHERE p.active_flag = true;

-- Insert tasks
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT DISTINCT 'task', t.id, t.name, t.code
FROM app.task t WHERE t.active_flag = true;

-- Insert businesses
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT DISTINCT 'business', b.id, b.name, b.code
FROM app.business b WHERE b.active_flag = true;

-- Insert employees
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT DISTINCT 'employee', e.id, e.name, e.code
FROM app.employee e WHERE e.active_flag = true;

-- ============================================================================
-- RBAC & LINK VERIFICATION QUERIES
-- ============================================================================

SELECT 'RBAC Summary' as report;
SELECT
    'Type-Level CREATE' as permission_type,
    COUNT(*) as count
FROM app.entity_rbac
WHERE permission = 6
  AND entity_instance_id = '11111111-1111-1111-1111-111111111111'
  AND person_code = 'employee'
UNION ALL
SELECT
    'Instance-Level VIEW' as permission_type,
    COUNT(*) as count
FROM app.entity_rbac
WHERE permission = 0
  AND entity_instance_id != '11111111-1111-1111-1111-111111111111'
  AND person_code = 'employee'
UNION ALL
SELECT
    'Instance-Level EDIT' as permission_type,
    COUNT(*) as count
FROM app.entity_rbac
WHERE permission = 3
  AND entity_instance_id != '11111111-1111-1111-1111-111111111111'
  AND person_code = 'employee'
UNION ALL
SELECT
    'Instance-Level DELETE' as permission_type,
    COUNT(*) as count
FROM app.entity_rbac
WHERE permission = 5
  AND entity_instance_id != '11111111-1111-1111-1111-111111111111'
  AND person_code = 'employee'
UNION ALL
SELECT
    'Instance-Level OWNER' as permission_type,
    COUNT(*) as count
FROM app.entity_rbac
WHERE permission = 7
  AND entity_instance_id != '11111111-1111-1111-1111-111111111111'
  AND person_code = 'employee';

SELECT 'Entity Instance Link Summary' as report;
SELECT
    entity_code || ' → ' || child_entity_code as relationship,
    COUNT(*) as link_count
FROM app.entity_instance_link
GROUP BY entity_code, child_entity_code
ORDER BY link_count DESC;

SELECT 'Entity Instance Registry' as report;
SELECT entity_code, COUNT(*) as instance_count
FROM app.entity_instance
GROUP BY entity_code
ORDER BY instance_count DESC;

-- Update table comment
COMMENT ON TABLE app.entity_rbac IS 'Role-based RBAC system (v2.0.0). Permissions granted to roles only via role_id FK. Persons get permissions through role membership via entity_instance_link. Inheritance modes: none, cascade, mapped. SEED DATA LOADED from big_data.sql';


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
