-- ============================================================================
-- TASK-EMPLOYEE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between tasks and employees, supporting flexible
--   task assignment where multiple employees may work on a single task, or
--   employees may be assigned to multiple concurrent tasks across different
--   projects and timeframes.
--
-- Integration:
--   - Links ops_task_head to d_employee for workforce allocation
--   - Supports complex task assignment and resource management
--   - Enables time tracking and performance measurement at task level
--   - Facilitates workload balancing and capacity planning

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_task_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  task_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Assignment details
  assignment_type text DEFAULT 'assigned',
  role_on_task text DEFAULT 'contributor',
  responsibility_level text DEFAULT 'standard',
  
  -- Time and effort allocation
  allocated_hours numeric(6,2),
  actual_hours numeric(6,2),
  allocation_percentage numeric(5,2) DEFAULT 100.00,
  
  -- Assignment dates
  assignment_date date DEFAULT CURRENT_DATE,
  start_date date,
  completion_date date,
  
  -- Performance and quality
  performance_rating numeric(3,1),
  quality_score numeric(3,1),
  completion_status text DEFAULT 'assigned',
  
  -- Unique constraint to prevent duplicate active assignments
  UNIQUE(task_id, employee_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Task-Employee Assignments for Huron Home Services Operations

-- Fall 2025 Landscaping Campaign Task Assignments
WITH fall_tasks AS (
  SELECT 
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-FALL-001') AS thompson_cleanup_id,
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-FALL-002') AS square_one_id,
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-FALL-003') AS miller_winterization_id
),
landscaping_crew AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014') AS carlos_santos_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-015') AS patricia_lee_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-019') AS emma_johnson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id
)

INSERT INTO app.rel_task_employee (
  task_id, employee_id, assignment_type, role_on_task, responsibility_level,
  allocated_hours, allocation_percentage, assignment_date, start_date,
  completion_status
)
-- Thompson Residence Fall Cleanup Team
SELECT 
  fall_tasks.thompson_cleanup_id,
  landscaping_crew.carlos_santos_id,
  'lead',
  'crew_leader',
  'primary',
  12.0,
  100.00,
  '2025-10-10'::date,
  '2025-10-15'::date,
  'in_progress'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.thompson_cleanup_id,
  landscaping_crew.emma_johnson_id,
  'assigned',
  'contributor',
  'support',
  12.0,
  100.00,
  '2025-10-10'::date,
  '2025-10-15'::date,
  'assigned'
FROM fall_tasks, landscaping_crew

-- Square One Plaza Fall Landscaping Team
UNION ALL

SELECT 
  fall_tasks.square_one_id,
  landscaping_crew.tom_richardson_id,
  'lead',
  'project_manager',
  'primary',
  40.0,
  100.00,
  '2025-10-15'::date,
  '2025-10-20'::date,
  'planned'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.square_one_id,
  landscaping_crew.carlos_santos_id,
  'assigned',
  'crew_leader',
  'secondary',
  32.0,
  80.00,
  '2025-10-15'::date,
  '2025-10-21'::date,
  'planned'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.square_one_id,
  landscaping_crew.patricia_lee_id,
  'assigned',
  'horticulture_specialist',
  'specialist',
  24.0,
  60.00,
  '2025-10-15'::date,
  '2025-10-22'::date,
  'planned'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.square_one_id,
  landscaping_crew.emma_johnson_id,
  'assigned',
  'contributor',
  'support',
  20.0,
  50.00,
  '2025-10-18'::date,
  '2025-10-23'::date,
  'planned'
FROM fall_tasks, landscaping_crew

-- Miller Properties Winterization Team  
UNION ALL

SELECT 
  fall_tasks.miller_winterization_id,
  landscaping_crew.patricia_lee_id,
  'lead',
  'horticulture_specialist',
  'primary',
  32.0,
  100.00,
  '2025-10-25'::date,
  '2025-11-01'::date,
  'scheduled'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.miller_winterization_id,
  landscaping_crew.carlos_santos_id,
  'assigned',
  'installation_specialist',
  'secondary',
  24.0,
  75.00,
  '2025-10-25'::date,
  '2025-11-02'::date,
  'scheduled'
FROM fall_tasks, landscaping_crew

UNION ALL

SELECT 
  fall_tasks.miller_winterization_id,
  landscaping_crew.amanda_foster_id,
  'consultant',
  'design_consultant',
  'advisory',
  8.0,
  25.00,
  '2025-10-28'::date,
  '2025-11-01'::date,
  'scheduled'
FROM fall_tasks, landscaping_crew;

-- Winter 2025 Snow Operations Task Assignments
WITH winter_tasks AS (
  SELECT 
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-WINTER-001') AS equipment_prep_id,
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-WINTER-002') AS meadowvale_route_id
),
winter_crew AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-018') AS john_macdonald_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-016') AS mike_wilson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-020') AS alex_dubois_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id
)

INSERT INTO app.rel_task_employee (
  task_id, employee_id, assignment_type, role_on_task, responsibility_level,
  allocated_hours, allocation_percentage, assignment_date, start_date,
  completion_status, performance_rating
)
-- Equipment Preparation Team
SELECT 
  winter_tasks.equipment_prep_id,
  winter_crew.john_macdonald_id,
  'lead',
  'maintenance_supervisor',
  'primary',
  80.0,
  100.00,
  '2025-11-01'::date,
  '2025-11-15'::date,
  'in_progress',
  4.5
FROM winter_tasks, winter_crew

UNION ALL

SELECT 
  winter_tasks.equipment_prep_id,
  winter_crew.mike_wilson_id,
  'assigned',
  'equipment_operator',
  'secondary',
  40.0,
  50.00,
  '2025-11-05'::date,
  '2025-11-20'::date,
  'assigned',
  NULL
FROM winter_tasks, winter_crew

UNION ALL

SELECT 
  winter_tasks.equipment_prep_id,
  winter_crew.alex_dubois_id,
  'assigned',
  'equipment_operator',
  'support',
  32.0,
  40.00,
  '2025-11-10'::date,
  '2025-11-25'::date,
  'assigned',
  NULL
FROM winter_tasks, winter_crew

-- Meadowvale Business Park Route Setup Team
UNION ALL

SELECT 
  winter_tasks.meadowvale_route_id,
  winter_crew.mike_wilson_id,
  'lead',
  'route_coordinator',
  'primary',
  16.0,
  100.00,
  '2025-11-15'::date,
  '2025-11-20'::date,
  'in_progress',
  4.2
FROM winter_tasks, winter_crew

UNION ALL

SELECT 
  winter_tasks.meadowvale_route_id,
  winter_crew.tom_richardson_id,
  'consultant',
  'project_advisor',
  'advisory',
  8.0,
  50.00,
  '2025-11-16'::date,
  '2025-11-21'::date,
  'assigned',
  NULL
FROM winter_tasks, winter_crew;

-- HVAC Maintenance Contract Task Assignments
WITH hvac_tasks AS (
  SELECT 
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-HVAC-001') AS toronto_tower_inspection_id,
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-HVAC-002') AS cam_emergency_response_id
),
hvac_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id
)

INSERT INTO app.rel_task_employee (
  task_id, employee_id, assignment_type, role_on_task, responsibility_level,
  allocated_hours, allocation_percentage, assignment_date, start_date,
  completion_status
)
-- Toronto Tower HVAC Inspection Team
SELECT 
  hvac_tasks.toronto_tower_inspection_id,
  hvac_team.kevin_obrien_id,
  'lead',
  'lead_technician',
  'primary',
  40.0,
  100.00,
  '2025-02-05'::date,
  '2025-02-10'::date,
  'scheduled'
FROM hvac_tasks, hvac_team

UNION ALL

SELECT 
  hvac_tasks.toronto_tower_inspection_id,
  hvac_team.michael_patterson_id,
  'oversight',
  'technical_supervisor',
  'oversight',
  16.0,
  40.00,
  '2025-02-08'::date,
  '2025-02-12'::date,
  'scheduled'
FROM hvac_tasks, hvac_team

-- CAM Emergency Response Team
UNION ALL

SELECT 
  hvac_tasks.cam_emergency_response_id,
  hvac_team.michael_patterson_id,
  'lead',
  'emergency_coordinator',
  'primary',
  200.0,
  100.00,
  '2025-01-01'::date,
  '2025-01-01'::date,
  'on_call'
FROM hvac_tasks, hvac_team

UNION ALL

SELECT 
  hvac_tasks.cam_emergency_response_id,
  hvac_team.kevin_obrien_id,
  'backup',
  'backup_technician',
  'backup',
  100.0,
  50.00,
  '2025-01-01'::date,
  '2025-01-01'::date,
  'on_call'
FROM hvac_tasks, hvac_team;

-- Solar Installation Project Task Assignments
WITH solar_tasks AS (
  SELECT 
    (SELECT id FROM app.ops_task_head WHERE task_number = 'TASK-SOLAR-001') AS thompson_solar_design_id
),
solar_team AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id
)

INSERT INTO app.rel_task_employee (
  task_id, employee_id, assignment_type, role_on_task, responsibility_level,
  allocated_hours, allocation_percentage, assignment_date, start_date,
  completion_status, performance_rating
)
-- Thompson Residence Solar Design Team
SELECT 
  solar_tasks.thompson_solar_design_id,
  solar_team.michael_patterson_id,
  'lead',
  'system_designer',
  'primary',
  24.0,
  100.00,
  '2025-05-10'::date,
  '2025-05-15'::date,
  'in_progress',
  4.3
FROM solar_tasks, solar_team

UNION ALL

SELECT 
  solar_tasks.thompson_solar_design_id,
  solar_team.kevin_obrien_id,
  'assigned',
  'electrical_specialist',
  'secondary',
  16.0,
  67.00,
  '2025-05-12'::date,
  '2025-05-17'::date,
  'assigned',
  NULL
FROM solar_tasks, solar_team

UNION ALL

SELECT 
  solar_tasks.thompson_solar_design_id,
  solar_team.amanda_foster_id,
  'consultant',
  'landscape_integration',
  'consultant',
  8.0,
  33.00,
  '2025-05-15'::date,
  '2025-05-20'::date,
  'scheduled',
  NULL
FROM solar_tasks, solar_team;

-- Indexes removed for simplified import