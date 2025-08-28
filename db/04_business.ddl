-- ============================================================================
-- BUSINESS (business hierarchy)
-- ============================================================================

CREATE TABLE app.d_scope_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_biz_level(level_id),
  parent_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Now that business exists, add FK from worksite.biz_id
ALTER TABLE app.d_worksite
  ADD CONSTRAINT d_worksite_biz_fk
  FOREIGN KEY (biz_id) REFERENCES app.d_scope_business(id) ON DELETE SET NULL;
