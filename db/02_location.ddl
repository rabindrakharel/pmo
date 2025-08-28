-- ============================================================================
-- LOCATION (geographic and location data)
-- ============================================================================

CREATE TABLE app.d_scope_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_loc_level(level_id),
  parent_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  geom geometry(Geometry, 4326),
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
