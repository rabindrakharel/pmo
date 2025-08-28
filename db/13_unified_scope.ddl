-- ============================================================================
-- SCOPE PERMISSION RELATIONSHIP TABLE (replaces unified d_scope table)
-- ============================================================================

CREATE TABLE app.rel_scope_permission (
  scope_type text NOT NULL, -- 'business', 'location', 'hr', 'worksite', 'project', 'task', 'form', 'route_page', 'component', 'app'
  name text NOT NULL,
  "descr" text,
  scope_id uuid, -- references d_scope_business(id), d_scope_location(id), d_scope_hr(id) based on scope_type
  scope_level_id int, -- references various meta_*_level tables based on scope_type
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique names within scope type and parent
  UNIQUE(scope_type, name, scope_id, active),
  
  -- Add constraints to ensure scope_id references the correct table based on scope_type
  CONSTRAINT chk_scope_id_business 
    CHECK (scope_type != 'business' OR scope_id IS NULL OR 
           EXISTS (SELECT 1 FROM app.d_scope_business WHERE id = scope_id)),
  CONSTRAINT chk_scope_id_location 
    CHECK (scope_type != 'location' OR scope_id IS NULL OR 
           EXISTS (SELECT 1 FROM app.d_scope_location WHERE id = scope_id)),
  CONSTRAINT chk_scope_id_hr 
    CHECK (scope_type != 'hr' OR scope_id IS NULL OR 
           EXISTS (SELECT 1 FROM app.d_scope_hr WHERE id = scope_id))
);

-- Index for performance
CREATE INDEX idx_rel_scope_permission_type ON app.rel_scope_permission(scope_type);
CREATE INDEX idx_rel_scope_permission_parent ON app.rel_scope_permission(scope_id);
CREATE INDEX idx_rel_scope_permission_active ON app.rel_scope_permission(active) WHERE active = true;