-- ============================================================================
-- BIG DATA: 300 Businesses + 3,000 Projects + 30,000 Tasks
-- ============================================================================
--
-- RUN MANUALLY: psql -h localhost -p 5434 -U app -d app -f db/big_data.sql
-- NOT included in db-import.sh (run separately for performance testing)
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
-- STEP 1: GENERATE 300 BUSINESSES
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
    RAISE NOTICE 'Step 1: Generating 300 businesses...';

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
-- STEP 2: GENERATE 3,000 PROJECTS (10 per business)
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
    RAISE NOTICE 'Step 2: Generating 3,000 projects (10 per business)...';

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
-- STEP 3: GENERATE 30,000 TASKS (10 per project)
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
    RAISE NOTICE 'Step 3: Generating 30,000 tasks (10 per project)...';

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
-- VERIFICATION QUERIES
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

-- ============================================================================
-- CLEANUP SCRIPT (run if needed to remove generated data)
-- ============================================================================
--
-- To remove ONLY the big data (keep seed data):
--
-- DELETE FROM app.task WHERE metadata->>'batch' = 'big_data_30000';
-- DELETE FROM app.project WHERE metadata->>'batch' = 'big_data_3000';
-- DELETE FROM app.business WHERE metadata->>'batch' = 'big_data_300';
--
-- ============================================================================
