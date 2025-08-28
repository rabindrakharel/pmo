-- ============================================================================
-- WORKSITE (physical service sites; usually tied to a location and/or business)
-- ============================================================================

CREATE TABLE app.d_worksite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  biz_id uuid,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  geom geometry(Geometry, 4326),
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
