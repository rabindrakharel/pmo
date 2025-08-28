-- ============================================================================
-- PROJECT (HEAD + RECORDS)
-- ============================================================================

CREATE TABLE app.ops_project_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  slug text UNIQUE,
  active boolean NOT NULL DEFAULT true,  -- Add active column for API compatibility
  
  -- Location scoping
  location_specific boolean NOT NULL DEFAULT false,
  location_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  location_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Business scoping
  business_specific boolean NOT NULL DEFAULT false,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  business_permission jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- worksite scoping
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid REFERENCES app.d_worksite(id),

  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.ops_project_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  status_id uuid NOT NULL REFERENCES app.meta_project_status(id),
  stage_id int REFERENCES app.meta_project_stage(level_id),
  dates jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Note: Role table uses project_ids array - FK constraints on arrays not supported in PostgreSQL
-- Array elements should be validated at application level
