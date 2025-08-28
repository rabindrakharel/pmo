-- ============================================================================
-- APPLICATION TABLES (UI/UX Components and Routes)
-- ============================================================================

-- Route Page Table for UI/UX route information
CREATE TABLE app.app_scope_d_route_page (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  route_path text NOT NULL UNIQUE,
  component_name text,
  parent_route_id uuid REFERENCES app.app_scope_d_route_page(id) ON DELETE SET NULL,
  is_protected boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Component Table for UI/UX components
CREATE TABLE app.app_scope_d_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  "descr" text,
  component_type text NOT NULL, -- 'page', 'modal', 'form', 'table', 'widget', etc.
  props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of component IDs this depends on
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Relationship table between routes and components (many-to-many)
CREATE TABLE app.rel_route_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES app.app_scope_d_route_page(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES app.app_scope_d_component(id) ON DELETE CASCADE,
  usage_type text NOT NULL DEFAULT 'main', -- 'main', 'sidebar', 'modal', 'widget', etc.
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(route_id, component_id, usage_type, active)
);