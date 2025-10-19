#!/bin/bash
# =====================================================
# TASK PERFORMANCE TEST DATA GENERATOR
# Creates 3000 tasks for each of the 5 existing projects
# Total: 15,000 tasks
# =====================================================

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5434}"
DB_USER="${DB_USER:-app}"
DB_PASSWORD="${DB_PASSWORD:-app}"
DB_NAME="${DB_NAME:-app}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Task Performance Test Data Generator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Target:${NC} 3000 tasks per project × 5 projects = ${GREEN}15,000 tasks${NC}"
echo ""

# Execute the SQL script
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<'EOF'

-- =====================================================
-- PERFORMANCE TEST DATA GENERATOR
-- Creates 3000 tasks for each of the 5 existing projects
-- Total: 15,000 tasks
-- =====================================================

DO $$
DECLARE
    -- Project IDs from existing data
    project_ids uuid[] := ARRAY[
        '93106ffb-402e-43a7-8b26-5287e37a1b0e'::uuid,  -- Digital Transformation
        '84215ccb-313d-48f8-9c37-4398f28c0b1f'::uuid,  -- Fall Landscaping Campaign
        '72304dab-202c-39e7-8a26-3287d26a0c2d'::uuid,  -- HVAC Modernization
        '61203bac-101b-28d6-7a15-2176c15a0b1c'::uuid,  -- Corporate Office Expansion
        '50192aab-000a-17c5-6904-1065b04a0a0b'::uuid   -- Customer Service Excellence
    ];

    -- Project codes for task naming
    project_codes text[] := ARRAY['DT', 'FLC', 'HVAC', 'COE', 'CSE'];

    -- Task stages (from setting_datalabel_task_stage)
    task_stages text[] := ARRAY['Backlog', 'Planning', 'In Progress', 'In Review', 'Blocked', 'Completed', 'Cancelled'];

    -- Priority levels (from setting_datalabel_task_priority)
    priorities text[] := ARRAY['low', 'medium', 'high', 'critical', 'urgent'];

    -- James Miller's employee ID
    james_miller_id uuid := '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'::uuid;

    -- Counters
    project_idx integer;
    task_idx integer;
    current_project_id uuid;
    current_project_code text;
    task_name text;
    task_slug text;
    task_code text;
    task_stage text;
    task_priority text;
    estimated_hrs decimal;
    actual_hrs decimal;
    story_pts integer;
BEGIN
    RAISE NOTICE 'Starting performance test data generation...';
    RAISE NOTICE 'Target: 3000 tasks per project × 5 projects = 15,000 tasks';

    -- Loop through each project
    FOR project_idx IN 1..5 LOOP
        current_project_id := project_ids[project_idx];
        current_project_code := project_codes[project_idx];

        RAISE NOTICE 'Generating tasks for project % (% of 5)...', current_project_code, project_idx;

        -- Generate 3000 tasks for this project
        FOR task_idx IN 1..3000 LOOP
            -- Generate task identifiers
            task_code := current_project_code || '-PERF-' || LPAD(task_idx::text, 5, '0');
            task_slug := LOWER(current_project_code) || '-perf-task-' || task_idx::text;
            task_name := 'Performance Test Task ' || task_idx || ' for ' || current_project_code;

            -- Randomize stage (weighted towards In Progress and Completed)
            task_stage := CASE (random() * 10)::integer
                WHEN 0 THEN 'Backlog'
                WHEN 1 THEN 'Planning'
                WHEN 2 THEN 'Planning'
                WHEN 3 THEN 'In Progress'
                WHEN 4 THEN 'In Progress'
                WHEN 5 THEN 'In Progress'
                WHEN 6 THEN 'In Review'
                WHEN 7 THEN 'In Review'
                WHEN 8 THEN 'Blocked'
                WHEN 9 THEN 'Completed'
                WHEN 10 THEN 'Completed'
                ELSE 'Planning'
            END;

            -- Randomize priority (weighted towards medium/high)
            task_priority := CASE (random() * 10)::integer
                WHEN 0 THEN 'low'
                WHEN 1 THEN 'low'
                WHEN 2 THEN 'medium'
                WHEN 3 THEN 'medium'
                WHEN 4 THEN 'medium'
                WHEN 5 THEN 'medium'
                WHEN 6 THEN 'high'
                WHEN 7 THEN 'high'
                WHEN 8 THEN 'high'
                WHEN 9 THEN 'critical'
                WHEN 10 THEN 'urgent'
                ELSE 'medium'
            END;

            -- Randomize effort estimates
            estimated_hrs := (random() * 80 + 4)::decimal(8,2);  -- 4-84 hours
            actual_hrs := CASE
                WHEN task_stage IN ('Completed', 'In Review') THEN (estimated_hrs * (0.8 + random() * 0.4))::decimal(8,2)
                WHEN task_stage = 'In Progress' THEN (estimated_hrs * random() * 0.7)::decimal(8,2)
                ELSE 0
            END;
            story_pts := CASE (random() * 5)::integer
                WHEN 0 THEN 1
                WHEN 1 THEN 2
                WHEN 2 THEN 3
                WHEN 3 THEN 5
                WHEN 4 THEN 8
                ELSE 3
            END;

            -- Insert task
            INSERT INTO app.d_task (
                slug, code, name, descr,
                tags, metadata,
                assignee_employee_ids,
                stage, priority_level,
                estimated_hours, actual_hours, story_points,
                active_flag, version
            ) VALUES (
                task_slug,
                task_code,
                task_name,
                'Performance test task #' || task_idx || ' created for load testing the project/task data table views. This task is part of a dataset of 15,000 tasks across 5 projects to validate table rendering, filtering, sorting, and pagination performance.',
                '["performance_test", "load_test", "automated"]'::jsonb,
                jsonb_build_object(
                    'task_type', 'performance_test',
                    'batch_number', project_idx,
                    'sequence_number', task_idx,
                    'project_id', current_project_id::text,
                    'generated_at', NOW()
                ),
                ARRAY[james_miller_id]::uuid[],
                task_stage,
                task_priority,
                estimated_hrs,
                actual_hrs,
                story_pts,
                true,
                1
            );

            -- Log progress every 500 tasks
            IF task_idx % 500 = 0 THEN
                RAISE NOTICE '  - Generated % tasks for project %', task_idx, current_project_code;
            END IF;
        END LOOP;

        RAISE NOTICE 'Completed project % (3000 tasks)', current_project_code;
    END LOOP;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Performance test data generation complete!';
    RAISE NOTICE 'Total tasks created: 15,000';
    RAISE NOTICE '========================================';

END $$;

-- =====================================================
-- POPULATE ENTITY INSTANCE REGISTRY
-- Register all performance test tasks in d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'task', id, name, slug, code
FROM app.d_task
WHERE code LIKE '%-PERF-%'
  AND active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
  SET entity_name = EXCLUDED.entity_name,
      entity_slug = EXCLUDED.entity_slug,
      entity_code = EXCLUDED.entity_code,
      updated_ts = now();

-- =====================================================
-- CREATE LINKAGE ENTRIES
-- Link all performance test tasks to their parent projects
-- =====================================================

INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'project',
    t.metadata->>'project_id',
    'task',
    t.id::text,
    'contains'
FROM app.d_task t
WHERE t.code LIKE '%-PERF-%'
  AND t.active_flag = true
  AND t.metadata->>'project_id' IS NOT NULL
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id) DO UPDATE
  SET updated_ts = now();

-- Verify the data
SELECT
    p.code AS project_code,
    p.name AS project_name,
    COUNT(t.id) AS task_count
FROM app.d_project p
LEFT JOIN app.d_task t ON t.metadata->>'project_id' = p.id::text
    AND t.code LIKE '%-PERF-%'
    AND t.active_flag = true
WHERE p.id IN (
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    '72304dab-202c-39e7-8a26-3287d26a0c2d',
    '61203bac-101b-28d6-7a15-2176c15a0b1c',
    '50192aab-000a-17c5-6904-1065b04a0a0b'
)
GROUP BY p.code, p.name
ORDER BY p.code;

-- Show total count
SELECT COUNT(*) as total_perf_tasks
FROM app.d_task
WHERE code LIKE '%-PERF-%'
AND active_flag = true;

-- Show stage distribution
SELECT
    stage,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM app.d_task WHERE code LIKE '%-PERF-%'), 2) as percentage
FROM app.d_task
WHERE code LIKE '%-PERF-%'
AND active_flag = true
GROUP BY stage
ORDER BY count DESC;

-- Verify entity registry
SELECT COUNT(*) as tasks_registered_in_entity_registry
FROM app.d_entity_instance_id
WHERE entity_type = 'task'
  AND entity_code LIKE '%-PERF-%';

-- Verify linkage by project
SELECT
    p.code AS project_code,
    COUNT(eim.id) AS linked_tasks
FROM app.d_project p
LEFT JOIN app.d_entity_id_map eim ON eim.parent_entity_id = p.id::text
    AND eim.parent_entity_type = 'project'
    AND eim.child_entity_type = 'task'
    AND eim.active_flag = true
WHERE p.id IN (
    '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    '72304dab-202c-39e7-8a26-3287d26a0c2d',
    '61203bac-101b-28d6-7a15-2176c15a0b1c',
    '50192aab-000a-17c5-6904-1065b04a0a0b'
)
GROUP BY p.code
ORDER BY p.code;

EOF

echo ""
echo -e "${GREEN}✓ Task performance test data generation complete!${NC}"
echo ""
