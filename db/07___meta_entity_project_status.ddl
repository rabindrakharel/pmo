-- ============================================================================
-- PROJECT STATUS META DEFINITIONS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining project lifecycle status values from Draft
--   through completion or termination. Provides comprehensive workflow state
--   management for project governance and reporting.
--
-- Status Categories:
--   Initial: DRAFT, SUBMITTED
--   Planning: UNDER_REVIEW, PLANNING, BUDGETING
--   Approved: APPROVED, SCHEDULED
--   Active: ACTIVE, AT_RISK, CRITICAL
--   Suspended: ON_HOLD, BLOCKED
--   Completed: COMPLETED, DELIVERED
--   Terminated: CANCELLED, SUSPENDED_INDEFINITELY
--
-- Integration:
--   - Referenced by d_project table via status code
--   - Supports project workflow automation and governance
--   - Enables status-based reporting and dashboard visualization
--   - Facilitates project lifecycle management and compliance

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_project_status (
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

-- Project Status Definitions (ordered by workflow progression)
INSERT INTO app.meta_entity_project_status (level_id, level_name, slug, is_root, is_leaf) VALUES
-- Initial States
(1, 'Draft', 'draft', true, false),
(2, 'Submitted', 'submitted', false, false),
-- Planning States
(3, 'Under Review', 'under-review', false, false),
(4, 'Planning', 'planning', false, false),
(5, 'Budgeting', 'budgeting', false, false),
-- Approved States
(6, 'Approved', 'approved', false, false),
(7, 'Scheduled', 'scheduled', false, false),
-- Active States
(8, 'Active', 'active', false, false),
(9, 'At Risk', 'at-risk', false, false),
(10, 'Critical', 'critical', false, false),
-- Suspended States
(11, 'On Hold', 'on-hold', false, false),
(12, 'Blocked', 'blocked', false, false),
-- Completed States
(13, 'Completed', 'completed', false, true),
(14, 'Delivered', 'delivered', false, true),
-- Terminated States
(15, 'Cancelled', 'cancelled', false, true),
(16, 'Suspended Indefinitely', 'suspended-indefinitely', false, true);

-- Indexes removed for simplified import