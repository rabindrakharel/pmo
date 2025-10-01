-- ============================================================================
-- XXVII. POSITION HIERARCHY META LEVELS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining organizational position hierarchy levels from
--   CEO/President (level 0) to Associate Director (level 7). Establishes
--   organizational authority levels and career progression paths for internal
--   human resources management and organizational structure.
--
-- Entity Type: meta_position_level
-- Entity Classification: Meta Configuration Table
--
-- Hierarchy Structure:
--   Level 0: CEO/President - Chief Executive Officer or President (root level)
--   Level 1: C-Level - Chief Officers (CTO, CFO, COO, etc.)
--   Level 2: SVP/EVP - Senior/Executive Vice President
--   Level 3: VP - Vice President
--   Level 4: AVP - Assistant Vice President
--   Level 5: Senior Director - Senior Director Level
--   Level 6: Director - Director Level
--   Level 7: Associate Director - Associate Director Level (leaf level)
--
-- New Design Integration:
--   - Referenced by d_position table via level_id for hierarchy validation
--   - Supports organizational reporting chains and authority delegation
--   - Enables career progression planning and succession management
--   - Facilitates compensation planning and performance management
--   - Uses standard meta table structure with common fields
--
-- Legacy Design Elements Retained:
--   - Level-based hierarchy with clear organizational structure
--   - Root and leaf level designations
--   - Slug-based referencing for UI navigation
--   - Temporal tracking for organizational changes
--
-- Business Rules:
--   - CEO/President level (0) is always root, never leaf
--   - Associate Director level (7) is always leaf, never root
--   - Middle levels (1-6) are neither root nor leaf
--   - Level IDs must be sequential and unique
--   - Level names must reflect organizational hierarchy
--   - Supports organizational chart generation
--
-- Career Progression:
--   - Defines clear advancement paths
--   - Supports succession planning
--   - Enables compensation band alignment
--   - Facilitates performance review processes
--
-- UI Integration:
--   - Used for organizational chart displays
--   - Supports position hierarchy visualization
--   - Enables authority-based workflow routing
--   - Provides context for approval level assignments

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_position_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standardized meta fields
  level_id int NOT NULL,
  level_name text NOT NULL,
  slug text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  is_leaf boolean NOT NULL DEFAULT false,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  active_flag boolean NOT NULL DEFAULT true,

  -- Additional meta configuration
  authority_description text,
  typical_span_of_control jsonb DEFAULT '{}'::jsonb,
  career_progression jsonb DEFAULT '{}'::jsonb,
  compensation_guidance jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Position Hierarchy Levels (CEO starts at level 0)
-- Comprehensive organizational structure for internal hierarchy management

INSERT INTO app.meta_position_level (
  level_id, level_name, slug, is_root, is_leaf, authority_description,
  typical_span_of_control, career_progression, compensation_guidance
) VALUES
(0, 'CEO/President', 'ceo-president', true, false,
 'Chief Executive Officer or President with ultimate organizational authority and board reporting responsibility',
 '{"direct_reports": "5-10", "organizational_scope": "enterprise", "geographic_scope": "all_regions", "functional_scope": "all_functions"}',
 '{"entry_requirements": "15+ years executive experience", "typical_tenure": "5-10 years", "advancement_to": "board_positions", "succession_planning": "board_managed"}',
 '{"salary_range": "300K-600K", "bonus_target": "50%", "equity_participation": "significant", "benefits_tier": "executive"}'),

(1, 'C-Level', 'c-level', false, false,
 'Chief Officers with functional or operational leadership across enterprise divisions',
 '{"direct_reports": "4-8", "organizational_scope": "functional", "geographic_scope": "enterprise", "functional_scope": "specialized"}',
 '{"entry_requirements": "12+ years senior management", "typical_tenure": "4-8 years", "advancement_to": "CEO/President", "succession_planning": "CEO_managed"}',
 '{"salary_range": "250K-450K", "bonus_target": "40%", "equity_participation": "substantial", "benefits_tier": "executive"}'),

(2, 'SVP/EVP', 'svp-evp', false, false,
 'Senior or Executive Vice President with multi-divisional responsibility and strategic planning authority',
 '{"direct_reports": "3-8", "organizational_scope": "multi_divisional", "geographic_scope": "regional_or_enterprise", "functional_scope": "broad"}',
 '{"entry_requirements": "10+ years management experience", "typical_tenure": "3-6 years", "advancement_to": "C-Level", "succession_planning": "CEO_and_board"}',
 '{"salary_range": "200K-350K", "bonus_target": "35%", "equity_participation": "moderate", "benefits_tier": "senior_executive"}'),

(3, 'VP', 'vp', false, false,
 'Vice President with divisional or major functional area leadership and strategic implementation responsibility',
 '{"direct_reports": "3-6", "organizational_scope": "divisional", "geographic_scope": "regional", "functional_scope": "specialized"}',
 '{"entry_requirements": "8+ years management experience", "typical_tenure": "3-5 years", "advancement_to": "SVP/EVP", "succession_planning": "C-Level_managed"}',
 '{"salary_range": "180K-320K", "bonus_target": "30%", "equity_participation": "limited", "benefits_tier": "senior_management"}'),

(4, 'AVP', 'avp', false, false,
 'Assistant Vice President with specialized functional responsibility and operational management authority',
 '{"direct_reports": "2-6", "organizational_scope": "functional", "geographic_scope": "local_or_regional", "functional_scope": "specialized"}',
 '{"entry_requirements": "6+ years management experience", "typical_tenure": "2-4 years", "advancement_to": "VP", "succession_planning": "VP_managed"}',
 '{"salary_range": "150K-280K", "bonus_target": "25%", "equity_participation": "minimal", "benefits_tier": "management"}'),

(5, 'Senior Director', 'senior-director', false, false,
 'Senior Director with significant departmental responsibility and strategic planning participation',
 '{"direct_reports": "2-5", "organizational_scope": "departmental", "geographic_scope": "local", "functional_scope": "specialized"}',
 '{"entry_requirements": "5+ years management experience", "typical_tenure": "2-4 years", "advancement_to": "AVP", "succession_planning": "VP_or_AVP_managed"}',
 '{"salary_range": "130K-250K", "bonus_target": "20%", "equity_participation": "none", "benefits_tier": "management"}'),

(6, 'Director', 'director', false, false,
 'Director with departmental management responsibility and operational planning authority',
 '{"direct_reports": "2-4", "organizational_scope": "departmental", "geographic_scope": "local", "functional_scope": "focused"}',
 '{"entry_requirements": "4+ years management experience", "typical_tenure": "2-3 years", "advancement_to": "Senior Director", "succession_planning": "senior_director_managed"}',
 '{"salary_range": "110K-200K", "bonus_target": "15%", "equity_participation": "none", "benefits_tier": "management"}'),

(7, 'Associate Director', 'associate-director', false, true,
 'Associate Director with specialized management responsibility and team leadership authority',
 '{"direct_reports": "1-4", "organizational_scope": "team_or_project", "geographic_scope": "local", "functional_scope": "specialized"}',
 '{"entry_requirements": "3+ years management experience", "typical_tenure": "2-3 years", "advancement_to": "Director", "succession_planning": "director_managed"}',
 '{"salary_range": "90K-160K", "bonus_target": "10%", "equity_participation": "none", "benefits_tier": "professional"}');