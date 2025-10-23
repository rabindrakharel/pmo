-- ============================================================================
-- SETTING TASK STAGE TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of task workflow progression. This is a
--   SEQUENTIAL STATE table where each stage represents a discrete phase in the
--   task management workflow. Stages form a graph-like flow where transitions
--   between states follow agile/kanban methodologies common in project management.
--
-- Sequential State Behavior:
--   - Tasks progress through stages following agile workflow patterns
--   - Allows circular transitions (e.g., In Review -> In Progress for rework)
--   - Multiple entry points possible (Backlog can skip to In Progress)
--   - Terminal states (Done, Cancelled) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Agile/Scrum workflow adapted for home services project management:
--   1. Backlog: Task identified but not yet prioritized or scheduled
--   2. To Do: Task ready to start, assigned to sprint/milestone
--   3. In Progress: Task actively being worked on by team member
--   4. In Review: Task completed, awaiting quality check or approval
--   5. Blocked: Task halted due to external dependency or impediment
--   6. Done: Task completed successfully and accepted
--   7. Cancelled: Task obsolete or no longer needed
--
-- Typical State Transitions:
--   Backlog -> To Do -> In Progress -> In Review -> Done
--   In Progress -> Blocked -> In Progress (after blocker resolved)
--   In Review -> In Progress (rework needed after review)
--   Any stage -> Cancelled (task obsolescence)
--
-- Integration Points:
--   - d_task.stage references this table
--   - Kanban boards visualize tasks grouped by stage
--   - Sprint burndown charts track stage progression
--   - Team velocity metrics based on stage transitions
--   - Workflow automation sends notifications on stage changes
--
-- UI/UX Usage:
--   - Stage selector dropdown in task forms
--   - Kanban columns for drag-and-drop stage changes
--   - Color-coded stage badges in task lists
--   - Stage transition workflow diagrams
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing task progression through the agile workflow.
--
--   Display Format: ● Backlog → ● To Do → ● **In Progress** → ○ In Review → ○ Done → ○ Blocked
--   - Current stage: Blue circle with checkmark, ring effect, highlighted label
--   - Past stages: Light blue circles with checkmarks
--   - Future stages: Gray circles, dimmed labels
--   - Interactive: Click any stage to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'stage' pattern in the field key ('task_stage' or 'stage'). Configuration
--   is centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Typical order: 1=Backlog, 2=To Do, 3=In Progress, 4=In Review, 5=Done, 6=Blocked
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=task_stage
--   - Returns stages with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual workflow context in task forms, kanban boards, and detail pages
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_task_stage (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between stages
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for setting task stage
CREATE INDEX idx_task_stage_parent ON app.setting_datalabel_task_stage(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Task workflow stages with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding stage (null for initial states)

INSERT INTO app.setting_datalabel_task_stage (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'Backlog', 'Task identified but not started. Awaiting prioritization and sprint assignment.', 1, NULL),
(1, 'To Do', 'Task ready to be started. Assigned to current sprint and ready for work.', 2, 0),
(2, 'In Progress', 'Task currently being worked on. Active development or execution phase.', 3, 1),
(3, 'In Review', 'Task completed, awaiting review. Pending quality check or stakeholder approval.', 4, 2),
(4, 'Blocked', 'Task blocked by external dependency. Cannot progress until blocker is resolved.', 5, 2),
(5, 'Done', 'Task completed successfully. Deliverables accepted and verified. Terminal state.', 6, 3),
(6, 'Cancelled', 'Task cancelled before completion. No longer relevant or needed. Terminal state.', 7, NULL);

-- Add foreign key constraint to reference setting tables
ALTER TABLE app.d_task
ADD CONSTRAINT fk_task_stage
FOREIGN KEY (stage) ;

COMMENT ON TABLE app.setting_datalabel_task_stage IS 'Sequential state table for task workflow stages with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_task_stage.parent_id IS 'Most common preceding stage in the workflow graph. NULL for initial or independent states.';
