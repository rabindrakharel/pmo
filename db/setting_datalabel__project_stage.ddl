-- ============================================================================
-- SETTING PROJECT STAGE TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of project lifecycle progression. This is a
--   SEQUENTIAL STATE table where each stage represents a discrete phase in the
--   project management workflow. Stages form a graph-like flow where transitions
--   between states are governed by business rules and project management policies.
--
-- Sequential State Behavior:
--   - Projects progress through stages in a generally linear fashion
--   - Some stages allow branching (e.g., Execution -> On Hold -> Back to Execution)
--   - Terminal states (Closure, Cancelled) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Project Management Institute (PMI) standard lifecycle adapted for home services:
--   1. Initiation: Project charter, stakeholder identification, feasibility
--   2. Planning: Scope definition, resource allocation, schedule creation
--   3. Execution: Deliverables creation, team coordination, work performance
--   4. Monitoring: Progress tracking, quality control, risk management
--   5. Closure: Deliverables handoff, documentation, lessons learned
--   6. On Hold: Temporary suspension (seasonal, budget delays, resource constraints)
--   7. Cancelled: Project termination before completion
--
-- Typical State Transitions:
--   Initiation -> Planning -> Execution -> Monitoring -> Closure
--   Execution -> On Hold -> Execution (resume after pause)
--   Any stage -> Cancelled (early termination)
--
-- Integration Points:
--   - d_project.project_stage references this table
--   - Kanban boards visualize projects grouped by stage
--   - Reporting dashboards track stage distribution and duration
--   - Workflow automation triggers notifications on stage transitions
--
-- UI/UX Usage:
--   - Stage selector dropdown in project forms
--   - Kanban columns for drag-and-drop stage changes
--   - Color-coded stage badges in project lists
--   - Stage transition workflow diagrams
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing project progression from left to right.
--
--   Display Format: ● Initiation → ● Planning → ● **Execution** → ○ Monitoring → ○ Closure
--   - Current stage: Blue circle with checkmark, ring effect, highlighted label
--   - Past stages: Light blue circles with checkmarks
--   - Future stages: Gray circles, dimmed labels
--   - Interactive: Click any stage to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'stage' pattern in the field key ('project_stage'). Configuration is
--   centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Stages are ordered: 1=Initiation, 2=Planning, 3=Execution, 4=Monitoring, 5=Closure
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=project_stage
--   - Returns states with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual workflow context during project creation and editing
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_project_stage (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between stages
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for setting project stage
CREATE INDEX idx_project_stage_parent ON app.setting_datalabel_project_stage(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Project lifecycle stages with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding stage (null for initial states)

INSERT INTO app.setting_datalabel_project_stage (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'Initiation', 'Project concept and initial planning. Starting point for all projects.', 1, NULL),
(1, 'Planning', 'Detailed project planning and resource allocation. Follows project approval.', 2, 0),
(2, 'Execution', 'Active project execution phase. Work is being performed by the project team.', 3, 1),
(3, 'Monitoring', 'Project monitoring and control. Tracking progress and managing changes.', 4, 2),
(4, 'Closure', 'Project completion and closure activities. Final deliverables and documentation.', 5, 3),
(5, 'On Hold', 'Project temporarily suspended. Can resume to Execution or Planning stages.', 6, 2),
(6, 'Cancelled', 'Project cancelled before completion. Terminal state with no forward transitions.', 7, NULL);

-- Add foreign key constraint to reference setting tables
ALTER TABLE app.d_project
ADD CONSTRAINT fk_project_stage
FOREIGN KEY (project_stage) ;

COMMENT ON TABLE app.setting_datalabel_project_stage IS 'Sequential state table for project lifecycle stages with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_project_stage.parent_id IS 'Most common preceding stage in the workflow graph. NULL for initial or independent states.';
