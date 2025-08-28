-- ============================================================================
-- PERMISSION RELATIONSHIP TABLES
-- ============================================================================

-- Role-Scope Permission relationship table
CREATE TABLE app.rel_role_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_name text NOT NULL,
  resource_type text NOT NULL, -- 'location', 'business', 'hr', 'worksite', 'app', 'project', 'task', 'form', 'route_page', 'component'
  resource_id uuid, -- specific resource ID within the resource_type
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[], -- array of permissions: 0:view, 1:modify, 2:share, 3:delete, 4:create
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(role_id, scope_type, scope_name, resource_type, resource_id, active),
  
  -- Foreign key constraint to rel_scope_permission
  FOREIGN KEY (scope_type, scope_name) REFERENCES app.rel_scope_permission(scope_type, name) ON DELETE CASCADE
);

-- User-Scope Permission relationship table (direct user permissions)
CREATE TABLE app.rel_user_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  scope_type text NOT NULL,  -- 'location', 'business', 'hr', 'worksite', 'app', 'project', 'task', 'form', 'route_page', 'component'
  scope_id uuid, -- specific scope ID within the scope_type that maps from the scope_d_%.id
  scope_name text NOT NULL,
  scope_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[], -- array of permissions: 0:view, 1:modify, 2:share, 3:delete, 4:create
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(emp_id, scope_type, scope_name, active),
  
  -- Foreign key constraint to rel_scope_permission
  FOREIGN KEY (scope_type, scope_name) REFERENCES app.rel_scope_permission(scope_type, name) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_rel_role_scope_role ON app.rel_role_scope(role_id);
CREATE INDEX idx_rel_role_scope_scope ON app.rel_role_scope(scope_type, scope_name);
CREATE INDEX idx_rel_role_scope_type ON app.rel_role_scope(resource_type);
CREATE INDEX idx_rel_role_scope_resource ON app.rel_role_scope(resource_id);
CREATE INDEX idx_rel_role_scope_active ON app.rel_role_scope(active) WHERE active = true;

CREATE INDEX idx_rel_user_scope_emp ON app.rel_user_scope(emp_id);
CREATE INDEX idx_rel_user_scope_scope ON app.rel_user_scope(scope_type, scope_name);
CREATE INDEX idx_rel_user_scope_type ON app.rel_user_scope(scope_type);
CREATE INDEX idx_rel_user_scope_resource ON app.rel_user_scope(scope_id);
CREATE INDEX idx_rel_user_scope_active ON app.rel_user_scope(active) WHERE active = true;