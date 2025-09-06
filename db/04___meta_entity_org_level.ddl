-- ============================================================================
-- ORG HIERARCHY META LEVELS 
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining org hierarchy levels following Canadian
--   geographic and administrative structure from Corp-Region (level 0) to 
--   Address (level 7). Supports multi-jurisdictional operations.
--
-- Hierarchy Structure:
--   Level 0: Corp-Region - Corporate regional division spanning multiple countries
--   Level 1: Country - National boundary with federal jurisdiction
--   Level 2: Province - Provincial/territorial division with legislative authority  
--   Level 3: Economic Region - Statistics Canada economic region for reporting
--   Level 4: Metropolitan Area - Census metropolitan area or agglomeration
--   Level 5: City - Municipal corporation with local government
--   Level 6: District - Municipal district or neighbourhood
--   Level 7: Address - Specific street address and postal code (leaf level)
--
-- Integration:
--   - Referenced by d_org table via level_id
--   - Supports geographic reporting and jurisdictional compliance
--   - Enables org-based resource allocation and service delivery
--   - Facilitates regulatory compliance across multiple jurisdictions

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_org_level (
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

-- Canadian Org Hierarchy Levels (Corp-Region starts at level 0)
INSERT INTO app.meta_entity_org_level (level_id, level_name, slug, is_root, is_leaf) VALUES
(0, 'Corp-Region', 'corp-region', true, false),
(1, 'Country', 'country', false, false),
(2, 'Province', 'province', false, false),
(3, 'Economic Region', 'economic-region', false, false),
(4, 'Metropolitan Area', 'metropolitan-area', false, false),
(5, 'City', 'city', false, false),
(6, 'District', 'district', false, false),
(7, 'Address', 'address', false, true);

-- Indexes removed for simplified import