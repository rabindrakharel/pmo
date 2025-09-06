-- ============================================================================
-- PROJECT STAGE META DEFINITIONS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining project management stages following PMBOK
--   methodology from Initiation (level 1) to Closure (level 5). Provides
--   structured project lifecycle management framework.
--
-- Stage Structure:
--   Level 1: Initiation - Project charter and initial planning
--   Level 2: Planning - Comprehensive project planning and design
--   Level 3: Execution - Active project implementation and delivery
--   Level 4: Monitoring & Controlling - Performance monitoring and change control
--   Level 5: Closure - Project closure and organizational learning (leaf level)
--
-- Integration:
--   - Referenced by project artifacts and deliverables
--   - Supports PMBOK-aligned project management methodology
--   - Enables stage-based resource allocation and milestone tracking
--   - Facilitates project governance and quality gates

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Standardized meta fields
  level_id int NOT NULL,
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

-- Project Management Stages (PMBOK Aligned)
INSERT INTO app.meta_entity_project_stage (level_id, level_name, slug, is_root, is_leaf) VALUES
(1, 'Initiation', 'initiation', true, false),
(2, 'Planning', 'planning', false, false),
(3, 'Execution', 'execution', false, false),
(4, 'Monitoring & Controlling', 'monitoring-controlling', false, false),
(5, 'Closure', 'closure', false, true);

-- Indexes removed for simplified import