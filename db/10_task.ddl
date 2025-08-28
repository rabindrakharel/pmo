-- ============================================================================
-- TASK (HEAD + RECORDS + LOGS + GROUPS)
-- ============================================================================

CREATE TABLE app.ops_task_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  parent_head_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  title text NOT NULL,  -- Add title column for API compatibility
  
  -- Task-level ownership & workflow roles (live on head)
  assignee uuid REFERENCES app.d_emp(id) ON DELETE SET NULL,
  client_group_id uuid REFERENCES app.d_client_grp(id) ON DELETE SET NULL,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],      -- refs d_client.id (array)
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[],    -- refs d_emp.id (array)
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[],    -- refs d_emp.id (array)
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[],-- refs d_emp.id (array)

  -- Worksite reference at task level
  worksite_id uuid REFERENCES app.d_worksite(id) ON DELETE SET NULL,

  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Note: Role table uses task_ids array - FK constraints on arrays not supported in PostgreSQL
-- Array elements should be validated at application level

ALTER TABLE app.d_client_grp
  ADD CONSTRAINT d_client_grp_task_fk
  FOREIGN KEY (task_head_id) REFERENCES app.ops_task_head(id) ON DELETE CASCADE;

CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,

  title text NOT NULL,
  status_id uuid NOT NULL REFERENCES app.meta_task_status(id),
  stage_id uuid NOT NULL REFERENCES app.meta_task_stage(id),
  due_date date,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Optional: explicit membership over time (kept under TASK domain)
CREATE TABLE app.d_emp_grp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Task Logs (HEAD + RECORDS)
CREATE TABLE app.ops_tasklog_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "desc" text,
  schema jsonb NOT NULL,
  version int NOT NULL,
  proj_head_id uuid REFERENCES app.ops_project_head(id) ON DELETE SET NULL,
  task_head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,

  -- Log-level ownership & workflow roles (live on head)
  owner_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE RESTRICT,
  assignee uuid REFERENCES app.d_emp(id) ON DELETE SET NULL,
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[],

  -- Worksite reference at tasklog level
  worksite_id uuid REFERENCES app.d_worksite(id) ON DELETE SET NULL,
  
  client_group_id uuid REFERENCES app.d_client_grp(id) ON DELETE SET NULL,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],

  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.ops_tasklog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  tasklog_head_id uuid NOT NULL REFERENCES app.ops_tasklog_head(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES app.meta_tasklog_type(id),
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,

  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,

  state_id uuid NOT NULL REFERENCES app.meta_tasklog_state(id),

  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
