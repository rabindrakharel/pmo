-- ============================================================================
-- EMPLOYEE (merged identity + people) - Updated with Authentication
-- ============================================================================

CREATE TABLE app.d_emp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  addr text,
  email text UNIQUE,
  password_hash text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
