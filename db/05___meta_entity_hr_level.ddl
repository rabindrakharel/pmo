-- ============================================================================
-- HR HIERARCHY META LEVELS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining human resources hierarchy levels from 
--   CEO/President (level 0) to Associate Director (level 7). Establishes
--   organizational authority levels and career progression paths.
--
-- Hierarchy Structure:
--   Level 0: CEO/President - Chief Executive Officer or President
--   Level 1: C-Level - Chief Officers (CTO, CFO, COO, etc.)
--   Level 2: SVP/EVP - Senior/Executive Vice President
--   Level 3: VP - Vice President
--   Level 4: AVP - Assistant Vice President
--   Level 5: Senior Director - Senior Director Level
--   Level 6: Director - Director Level
--   Level 7: Associate Director - Associate Director Level (leaf level)
--
-- Integration:
--   - Referenced by d_hr and d_employee tables via level_id
--   - Supports organizational reporting chains and authority delegation
--   - Enables career progression planning and succession management
--   - Facilitates compensation planning and performance management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_hr_level (
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

-- HR Hierarchy Levels (CEO starts at level 0)
INSERT INTO app.meta_entity_hr_level (level_id, level_name, slug, is_root, is_leaf) VALUES
(0, 'CEO/President', 'ceo-president', true, false),
(1, 'C-Level', 'c-level', false, false),
(2, 'SVP/EVP', 'svp-evp', false, false),
(3, 'VP', 'vp', false, false),
(4, 'AVP', 'avp', false, false),
(5, 'Senior Director', 'senior-director', false, false),
(6, 'Director', 'director', false, false),
(7, 'Associate Director', 'associate-director', false, true);

-- Indexes removed for simplified import