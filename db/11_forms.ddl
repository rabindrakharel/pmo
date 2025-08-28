-- ============================================================================
-- FORMS (HEAD + RECORDS)
-- ============================================================================

CREATE TABLE app.ops_formlog_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "desc" text,
  form_global_link text UNIQUE, -- public shareable link for external form submissions

  -- Project scoping
  project_specific boolean NOT NULL DEFAULT false,
  project_id uuid,                            -- FK added after project tables
  project_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Task scoping
  task_specific boolean NOT NULL DEFAULT false,
  task_id uuid,                               -- FK added after task tables
  task_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Location scoping
  location_specific boolean NOT NULL DEFAULT false,
  location_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  location_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Business scoping
  business_specific boolean NOT NULL DEFAULT false,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  business_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- HR scoping
  hr_specific boolean NOT NULL DEFAULT false,
  hr_id uuid REFERENCES app.d_scope_hr(id) ON DELETE SET NULL,
  hr_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid REFERENCES app.d_worksite(id) ON DELETE SET NULL,
  worksite_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema jsonb NOT NULL,
  version int NOT NULL,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.ops_formlog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_formlog_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,

  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  proj_head_id uuid REFERENCES app.ops_project_head(id) ON DELETE SET NULL,
  task_head_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  tasklog_head_id uuid REFERENCES app.ops_tasklog_head(id) ON DELETE SET NULL,
  worksite_id uuid REFERENCES app.d_worksite(id) ON DELETE SET NULL,

  data jsonb NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  inserted timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
