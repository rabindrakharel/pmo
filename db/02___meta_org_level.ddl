-- ============================================================================
-- ORGANIZATIONAL HIERARCHY META LEVELS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining organizational hierarchy levels for business
--   units ranging from Corporation (level 0) to Sub-team (level 5).
--   Provides the structural foundation for enterprise organization.
--
-- Hierarchy Structure:
--   Level 0: Corporation - Top-level corporate entity with board governance
--   Level 1: Division - Major business division with P&L responsibility
--   Level 2: Department - Functional department with operational focus
--   Level 3: Team - Working team unit with specific deliverables
--   Level 4: Squad - Agile squad with cross-functional capabilities
--   Level 5: Sub-team - Specialized sub-team (leaf level)
--
-- Integration:
--   - Referenced by d_scope_org table via level_id
--   - Supports hierarchical organizational structures
--   - Enables proper reporting chains and authority levels
--   - Facilitates organizational change management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_org_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Standardized meta fields
  level_id int NOT NULL UNIQUE,
  level_name text NOT NULL,
  slug text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  is_leaf boolean NOT NULL DEFAULT false,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Organizational Hierarchy Levels (Corporation starts at level 0)
INSERT INTO app.meta_org_level (level_id, level_name, slug, is_root, is_leaf) VALUES
(0, 'Corporation', 'corporation', true, false),
(1, 'Division', 'division', false, false),
(2, 'Department', 'department', false, false), 
(3, 'Team', 'team', false, false),
(4, 'Squad', 'squad', false, false),
(5, 'Sub-team', 'subteam', false, true);

-- Indexes removed for simplified import