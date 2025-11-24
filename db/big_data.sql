-- ============================================================================
-- BIG DATA: 20,000 Projects + 40,000 Tasks for Performance Testing
-- ============================================================================
--
-- RUN MANUALLY: psql -h localhost -p 5434 -U app -d app -f db/big_data.sql
-- NOT included in db-import.sh
--
-- Distribution:
-- - 20,000 projects distributed across 6 existing businesses
-- - 40,000 tasks (2 per project) with varying stages/priorities
-- - Realistic Canadian home services project names and descriptions
-- ============================================================================

-- Existing business IDs:
-- b1111111-1111-1111-1111-111111111111 (Landscaping Team Alpha)
-- b2222222-2222-2222-2222-222222222222 (Landscaping Team Beta)
-- b3333333-3333-3333-3333-333333333333 (HVAC Installation Team)
-- b4444444-4444-4444-4444-444444444444 (HVAC Maintenance Team)
-- b5555555-5555-5555-5555-555555555555 (Property Maintenance Team)
-- b6666666-6666-6666-6666-666666666666 (Corporate Services Team)

-- ============================================================================
-- HELPER ARRAYS FOR RANDOM DATA GENERATION
-- ============================================================================

DO $$
DECLARE
    business_ids uuid[] := ARRAY[
        'b1111111-1111-1111-1111-111111111111',
        'b2222222-2222-2222-2222-222222222222',
        'b3333333-3333-3333-3333-333333333333',
        'b4444444-4444-4444-4444-444444444444',
        'b5555555-5555-5555-5555-555555555555',
        'b6666666-6666-6666-6666-666666666666'
    ];

    office_ids uuid[] := ARRAY[
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444'
    ];

    project_stages text[] := ARRAY['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closure', 'On Hold'];
    task_stages text[] := ARRAY['Backlog', 'Planning', 'To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'];
    task_priorities text[] := ARRAY['low', 'medium', 'high', 'critical'];

    -- Project name prefixes by service type
    landscaping_prefixes text[] := ARRAY[
        'Residential Lawn Care', 'Commercial Grounds', 'Garden Design', 'Landscape Installation',
        'Seasonal Cleanup', 'Tree Service', 'Irrigation System', 'Hardscape Construction',
        'Mulching Project', 'Sod Installation', 'Flower Bed Design', 'Hedge Trimming',
        'Snow Removal Contract', 'Outdoor Lighting', 'Patio Installation', 'Retaining Wall'
    ];

    hvac_prefixes text[] := ARRAY[
        'Furnace Installation', 'AC Replacement', 'Heat Pump Setup', 'Duct Cleaning',
        'HVAC Maintenance', 'Ventilation Upgrade', 'Thermostat Install', 'Air Quality',
        'Boiler Repair', 'Geothermal System', 'Radiant Heating', 'Mini Split Install',
        'Commercial HVAC', 'Emergency Repair', 'Energy Audit', 'Refrigerant Service'
    ];

    maintenance_prefixes text[] := ARRAY[
        'Roof Repair', 'Window Replacement', 'Door Installation', 'Deck Construction',
        'Fence Repair', 'Gutter Service', 'Pressure Washing', 'Painting Project',
        'Drywall Repair', 'Flooring Install', 'Plumbing Service', 'Electrical Update',
        'Bathroom Renovation', 'Kitchen Upgrade', 'Basement Finishing', 'Siding Repair'
    ];

    corporate_prefixes text[] := ARRAY[
        'IT Infrastructure', 'Software Implementation', 'Process Improvement', 'Training Program',
        'Compliance Audit', 'Quality Assurance', 'Customer Experience', 'Digital Marketing',
        'Fleet Management', 'Safety Program', 'Vendor Management', 'Cost Reduction',
        'Employee Wellness', 'Succession Planning', 'Brand Refresh', 'Data Analytics'
    ];

    -- Canadian cities/regions
    locations text[] := ARRAY[
        'Toronto', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Ottawa', 'Kitchener',
        'Burlington', 'Oakville', 'Vaughan', 'Richmond Hill', 'Markham', 'Pickering', 'Ajax',
        'Oshawa', 'Whitby', 'Barrie', 'Guelph', 'Cambridge', 'Waterloo', 'St. Catharines',
        'Niagara Falls', 'Windsor', 'Sudbury', 'Thunder Bay', 'Kingston', 'Peterborough'
    ];

    -- Client types
    client_types text[] := ARRAY[
        'Residential', 'Commercial', 'Industrial', 'Municipal', 'Institutional',
        'Retail', 'Healthcare', 'Educational', 'Hospitality', 'Multi-Family'
    ];

    -- Task name templates
    task_templates text[] := ARRAY[
        'Site Assessment', 'Material Procurement', 'Equipment Setup', 'Initial Survey',
        'Design Review', 'Client Consultation', 'Permit Application', 'Safety Inspection',
        'Quality Check', 'Progress Report', 'Documentation', 'Final Inspection',
        'Budget Review', 'Resource Allocation', 'Schedule Update', 'Risk Assessment',
        'Stakeholder Meeting', 'Status Update', 'Handover Preparation', 'Warranty Setup'
    ];

    i integer;
    j integer;
    project_id uuid;
    business_idx integer;
    selected_business uuid;
    project_prefix text;
    project_name text;
    location text;
    client_type text;
    budget decimal;
    start_date date;
    end_date date;
    project_stage text;
    task_id uuid;
    task_name text;
    task_stage text;
    task_priority text;
    estimated_hours numeric;

BEGIN
    RAISE NOTICE 'Starting big data generation: 20,000 projects + 40,000 tasks...';
    RAISE NOTICE 'This may take a few minutes...';

    -- ========================================================================
    -- GENERATE 20,000 PROJECTS
    -- ========================================================================
    FOR i IN 1..20000 LOOP
        project_id := gen_random_uuid();

        -- Distribute across businesses (roughly equal)
        business_idx := ((i - 1) % 6) + 1;
        selected_business := business_ids[business_idx];

        -- Select prefix based on business type
        CASE business_idx
            WHEN 1, 2 THEN -- Landscaping teams
                project_prefix := landscaping_prefixes[1 + floor(random() * array_length(landscaping_prefixes, 1))::int];
            WHEN 3, 4 THEN -- HVAC teams
                project_prefix := hvac_prefixes[1 + floor(random() * array_length(hvac_prefixes, 1))::int];
            WHEN 5 THEN -- Maintenance team
                project_prefix := maintenance_prefixes[1 + floor(random() * array_length(maintenance_prefixes, 1))::int];
            ELSE -- Corporate team
                project_prefix := corporate_prefixes[1 + floor(random() * array_length(corporate_prefixes, 1))::int];
        END CASE;

        -- Random location and client type
        location := locations[1 + floor(random() * array_length(locations, 1))::int];
        client_type := client_types[1 + floor(random() * array_length(client_types, 1))::int];

        -- Build project name
        project_name := project_prefix || ' - ' || location || ' ' || client_type || ' #' || i;

        -- Random budget (5000 to 500000)
        budget := 5000 + floor(random() * 495000);

        -- Random dates (within 2024-2025)
        start_date := '2024-01-01'::date + (floor(random() * 365) || ' days')::interval;
        end_date := start_date + ((30 + floor(random() * 335)) || ' days')::interval;

        -- Random stage (weighted towards active stages)
        project_stage := project_stages[1 + floor(random() * array_length(project_stages, 1))::int];

        -- Insert project
        INSERT INTO app.project (
            id, code, name, descr, metadata,
            dl__project_stage,
            budget_allocated_amt, budget_spent_amt,
            planned_start_date, planned_end_date,
            manager__employee_id, sponsor__employee_id
        ) VALUES (
            project_id,
            'PRJ-' || LPAD(i::text, 6, '0'),
            project_name,
            'Project for ' || client_type || ' client in ' || location || '. ' ||
            project_prefix || ' services including assessment, execution, and quality assurance.',
            jsonb_build_object(
                'business_id', selected_business,
                'location', location,
                'client_type', client_type,
                'service_category', project_prefix,
                'generated', true
            ),
            project_stage,
            budget,
            budget * (random() * 0.7), -- Spent up to 70%
            start_date,
            end_date,
            '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
            '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
        );

        -- ====================================================================
        -- GENERATE 2 TASKS PER PROJECT
        -- ====================================================================
        FOR j IN 1..2 LOOP
            task_id := gen_random_uuid();

            -- Random task template
            task_name := task_templates[1 + floor(random() * array_length(task_templates, 1))::int] ||
                         ' for ' || project_prefix;

            -- Random stage and priority
            task_stage := task_stages[1 + floor(random() * array_length(task_stages, 1))::int];
            task_priority := task_priorities[1 + floor(random() * array_length(task_priorities, 1))::int];

            -- Random hours (2 to 80)
            estimated_hours := 2 + floor(random() * 78);

            INSERT INTO app.task (
                id, code, name, descr, metadata,
                dl__task_stage, dl__task_priority,
                estimated_hours, actual_hours, story_points
            ) VALUES (
                task_id,
                'TSK-' || LPAD(((i - 1) * 2 + j)::text, 6, '0'),
                task_name,
                'Task ' || j || ' for project ' || project_name || '. ' ||
                task_name || ' activities and deliverables.',
                jsonb_build_object(
                    'project_id', project_id,
                    'business_id', selected_business,
                    'task_number', j,
                    'generated', true
                ),
                task_stage,
                task_priority,
                estimated_hours,
                CASE WHEN task_stage IN ('Completed', 'In Review')
                     THEN estimated_hours * (0.8 + random() * 0.4)
                     ELSE estimated_hours * random() * 0.5
                END,
                CASE task_priority
                    WHEN 'critical' THEN 13
                    WHEN 'high' THEN 8
                    WHEN 'medium' THEN 5
                    ELSE 3
                END
            );
        END LOOP;

        -- Progress indicator every 1000 projects
        IF i % 1000 = 0 THEN
            RAISE NOTICE 'Generated % projects and % tasks...', i, i * 2;
        END IF;
    END LOOP;

    RAISE NOTICE 'Completed: 20,000 projects and 40,000 tasks generated!';

END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count totals
SELECT 'Projects' as entity, COUNT(*) as count FROM app.project
UNION ALL
SELECT 'Tasks' as entity, COUNT(*) as count FROM app.task;

-- Distribution by project stage
SELECT dl__project_stage, COUNT(*) as count
FROM app.project
GROUP BY dl__project_stage
ORDER BY count DESC;

-- Distribution by task stage
SELECT dl__task_stage, COUNT(*) as count
FROM app.task
GROUP BY dl__task_stage
ORDER BY count DESC;

-- Projects per business
SELECT metadata->>'business_id' as business_id, COUNT(*) as projects
FROM app.project
WHERE metadata->>'generated' = 'true'
GROUP BY metadata->>'business_id'
ORDER BY projects DESC;
