-- ============================================================================
-- ROLE TABLE (simplified structure)
-- ============================================================================

CREATE TABLE app.d_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Employee-Role relationship table (many-to-many)
CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique active relationships
  UNIQUE(emp_id, role_id, active)
);