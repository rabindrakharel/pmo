-- ============================================================================
-- HR SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Human resources hierarchy dimension representing organizational positions
--   from CEO/President (level 0) through Associate Director (level 7).
--   Provides foundation for reporting relationships, authority delegation,
--   compensation planning, and career progression management.

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_hr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),

  -- Org hierarchy fields
  slug text,
  code text,
  level_id int NOT NULL REFERENCES app.meta_entity_hr_level(level_id),
  level_name text NOT NULL,
  is_leaf_level boolean NOT NULL DEFAULT false,
  is_root_level boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES app.d_hr(id) ON DELETE SET NULL,
  
  -- Position attributes
  is_management boolean NOT NULL DEFAULT false,
  is_executive boolean NOT NULL DEFAULT false,
  
  -- Compensation and authority
  salary_band_min numeric(10,2),
  salary_band_max numeric(10,2),
  bonus_target_pct numeric(5,2),
  equity_eligible boolean DEFAULT false,
  approval_limit numeric(12,2),
  
  -- Organizational capacity
  direct_reports_max int,
  remote_eligible boolean DEFAULT false
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Simplified HR hierarchy for Huron Home Services

-- Level 0: CEO/President
INSERT INTO app.d_hr (name, "descr", level_id, level_name, parent_id, is_leaf_level, is_management, is_executive, salary_band_min, salary_band_max, bonus_target_pct, equity_eligible, approval_limit, direct_reports_max, remote_eligible, tags, attr) VALUES
('Chief Executive Officer', 'Chief Executive Officer responsible for overall strategic direction, board reporting, and enterprise leadership', 0, 'CEO/President', NULL, false, true, true, 300000.00, 600000.00, 50.00, true, NULL, 8, true, '["executive", "ceo", "board-reporting", "strategic"]', '{"board_reporting": true, "public_facing": true, "strategic_planning": true, "investor_relations": true, "ultimate_authority": true, "succession_planning": true}');

-- Additional HR positions can be added later after the base system is working

-- Indexes removed for simplified import