-- ============================================================================
-- TASK STATUS META DEFINITIONS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining task lifecycle status values from Open through
--   completion or termination. Provides comprehensive task workflow state
--   management for development teams and project execution.
--
-- Status Categories:
--   Initial: OPEN, ASSIGNED
--   Active: IN_PROGRESS, RESEARCHING, DEVELOPING
--   Review: CODE_REVIEW, TESTING, REVIEW
--   Blocked: BLOCKED, ON_HOLD
--   Completed: DONE, DEPLOYED, VERIFIED
--   Terminated: CANCELLED, DEFERRED
--
-- Integration:
--   - Referenced by ops_task_head table via status code
--   - Supports task workflow automation and team coordination
--   - Enables status-based reporting and kanban visualization
--   - Facilitates agile development practices and sprint management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_entity_task_status (
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

-- Task Status Definitions (ordered by workflow progression)
INSERT INTO app.meta_entity_task_status (level_id, level_name, slug, is_root, is_leaf) VALUES
-- Initial States
(1, 'Open', 'open', true, false),
(2, 'Assigned', 'assigned', false, false),
-- Active States
(3, 'In Progress', 'in-progress', false, false),
(4, 'Researching', 'researching', false, false),
(5, 'Developing', 'developing', false, false),
-- Review States
(6, 'Code Review', 'code-review', false, false),
(7, 'Testing', 'testing', false, false),
(8, 'Under Review', 'under-review', false, false),
-- Blocked States
(9, 'Blocked', 'blocked', false, false),
(10, 'On Hold', 'on-hold', false, false),
-- Completion States
(11, 'Done', 'done', false, true),
(12, 'Deployed', 'deployed', false, true),
(13, 'Verified', 'verified', false, true),
-- Terminated States
(14, 'Cancelled', 'cancelled', false, true),
(15, 'Deferred', 'deferred', false, true);

-- Indexes removed for simplified import