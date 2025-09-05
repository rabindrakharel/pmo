-- ============================================================================
-- CLIENT HIERARCHY META LEVELS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining client organization hierarchy levels from
--   CEO (level 0) to Technical Lead (level 4). Represents authority levels
--   and decision-making patterns within client organizations for proper
--   engagement protocols and escalation management.
--
-- Hierarchy Structure:
--   Level 0: CEO - Chief Executive Officer with final decision authority
--   Level 1: Director - Director level with departmental authority
--   Level 2: Senior Manager - Senior Manager with program oversight authority
--   Level 3: Manager - Manager with team leadership and operational authority
--   Level 4: Technical Lead - Technical Lead with subject matter expertise (leaf level)
--
-- Integration:
--   - Referenced by d_client table via level_id
--   - Supports client engagement strategy and escalation paths
--   - Enables proper stakeholder management and communication protocols
--   - Facilitates contract authority and approval workflow management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_client_level (
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

-- Client Hierarchy Levels (CEO starts at level 0)
INSERT INTO app.meta_client_level (level_id, level_name, slug, is_root, is_leaf) VALUES
(0, 'CEO', 'ceo', true, false),
(1, 'Director', 'director', false, false),
(2, 'Senior Manager', 'senior-manager', false, false),
(3, 'Manager', 'manager', false, false),
(4, 'Technical Lead', 'technical-lead', false, true);

-- Indexes removed for simplified import