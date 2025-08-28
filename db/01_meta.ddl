-- ============================================================================
-- META (vocab + high-level definitions)
-- ============================================================================

-- Business Level Definitions
CREATE TABLE app.meta_biz_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

-- Location Level Definitions
CREATE TABLE app.meta_loc_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

-- HR Level Definitions
CREATE TABLE app.meta_hr_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

-- Project Status and Stages
CREATE TABLE app.meta_project_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.meta_project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

-- Task Status and Stages (Kanban columns)
CREATE TABLE app.meta_task_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.meta_task_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,   -- 'backlog','todo','in_progress','review','done','blocked'
  name text NOT NULL,
  sort_id int NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_done boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  color text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

-- Tasklog States & Types
CREATE TABLE app.meta_tasklog_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,   -- 'draft','submitted','in_review','approved','rejected','archived'
  name text NOT NULL,
  sort_id int NOT NULL,
  terminal boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.meta_tasklog_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,   -- 'comment','image','voice','email', etc.
  name text NOT NULL,
  sort_id int NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);
