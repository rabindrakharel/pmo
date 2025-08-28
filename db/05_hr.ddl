-- ============================================================================
-- HR (human resources hierarchy)
-- ============================================================================

CREATE TABLE app.d_scope_hr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_hr_level(level_id),
  parent_id uuid REFERENCES app.d_scope_hr(id) ON DELETE SET NULL,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);



CREATE TABLE app.rel_hr_biz_loc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid NOT NULL REFERENCES app.d_scope_hr(id) ON DELETE CASCADE,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb
);
