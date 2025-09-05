-- ============================================================================
-- TASK STAGE META DEFINITIONS (KANBAN)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Meta configuration defining kanban task stages from Icebox through Done.
--   Provides visual workflow management framework for agile development teams
--   with work-in-progress limits and stage-based coordination.
--
-- Stage Categories:
--   Backlog: icebox, backlog, ready, todo
--   Active: in_progress, code_review, testing
--   Review: review, uat, ready_for_deploy
--   Deployment: deployed
--   Completion: done
--   Exception: blocked, on_hold
--
-- Integration:
--   - Referenced by task management and kanban board systems
--   - Supports agile development practices and visual workflow management
--   - Enables WIP limit enforcement and flow optimization
--   - Facilitates sprint planning and team coordination

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.meta_task_stage (
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

-- Kanban Task Stages (ordered by workflow progression)
INSERT INTO app.meta_task_stage (level_id, level_name, slug, is_root, is_leaf) VALUES
-- Backlog and Planning
(1, 'Icebox', 'icebox', true, false),
(2, 'Backlog', 'backlog', false, false),
(3, 'Ready', 'ready', false, false),
(4, 'To Do', 'todo', false, false),
-- Active Work
(5, 'In Progress', 'in-progress', false, false),
(6, 'Code Review', 'code-review', false, false),
(7, 'Testing', 'testing', false, false),
-- Review and Validation
(8, 'Review', 'review', false, false),
(9, 'User Acceptance Testing', 'uat', false, false),
-- Deployment
(10, 'Ready for Deploy', 'ready-for-deploy', false, false),
(11, 'Deployed', 'deployed', false, false),
-- Completion
(12, 'Done', 'done', false, true),
-- Exception Handling
(13, 'Blocked', 'blocked', false, false),
(14, 'On Hold', 'on-hold', false, false);

-- Indexes removed for simplified import