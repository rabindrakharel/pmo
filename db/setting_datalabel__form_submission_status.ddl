-- ============================================================================
-- SETTING: FORM SUBMISSION STATUS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of form submission workflow. This is a
--   SEQUENTIAL STATE table where each status represents a discrete phase in the
--   form lifecycle from creation through submission, review, and final processing.
--   Statuses form a graph-like flow tracking forms through their complete journey.
--
-- Sequential State Behavior:
--   - Forms progress through submission workflow stages
--   - Allows circular transitions (e.g., rejected -> draft for corrections)
--   - Multiple exit paths (approved, rejected, withdrawn)
--   - Terminal states (approved, withdrawn) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Form submission lifecycle management for business processes:
--   1. Draft: Work in progress, not yet submitted
--   2. Submitted: Submitted and awaiting review
--   3. Under Review: Being reviewed by approver
--   4. Rejected: Requires revision, sent back to submitter
--   5. Approved: Approved and processed successfully
--   6. Withdrawn: Withdrawn by submitter before completion
--
-- Typical State Transitions:
--   draft -> submitted (form completed and submitted)
--   submitted -> under_review (reviewer starts evaluation)
--   under_review -> approved (review successful)
--   under_review -> rejected (revisions needed)
--   rejected -> draft (submitter makes corrections)
--   draft -> withdrawn (submitter cancels submission)
--
-- Integration Points:
--   - d_form_data.submission_status references this table
--   - Submission workflow automation triggers notifications
--   - Review queues filtered by submission status
--   - Reporting on submission cycle times
--
-- UI/UX Usage:
--   - Status dropdown in form interfaces
--   - Status badges in submission queues with color coding
--   - Submission dashboard showing workflow progress
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing form submission progression through review workflow.
--
--   Display Format: ● Pending → ● **Under Review** → ○ Completed → ○ Rejected
--   - Current status: Blue circle with checkmark, ring effect, highlighted label
--   - Past statuses: Light blue circles with checkmarks
--   - Future statuses: Gray circles, dimmed labels
--   - Interactive: Click any status to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'status' pattern in the field key ('submission_status'). Configuration
--   is centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Submission workflow: 1=Pending, 2=Under Review, 3=Completed, 4=Rejected
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=form_submission_status
--   - Returns statuses with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual submission workflow context in form interfaces and detail pages
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_form_submission_status (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between statuses
    is_active boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for form submission status
CREATE INDEX idx_form_submission_parent ON app.setting_datalabel_form_submission_status(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Form submission status values with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding status (null for initial states)

INSERT INTO app.setting_datalabel_form_submission_status (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'draft', 'Draft - not yet submitted. Work in progress. Initial entry point.', 0, NULL),
(1, 'submitted', 'Submitted - awaiting review. Form completed and sent for approval.', 1, 0),
(2, 'under_review', 'Under review by approver. Active evaluation in progress.', 2, 1),
(3, 'approved', 'Approved and processed successfully. Final state. Terminal state.', 3, 2),
(4, 'rejected', 'Rejected - requires revision. Sent back to submitter for corrections.', 4, 2),
(5, 'withdrawn', 'Withdrawn by submitter before completion. Cancelled submission. Terminal state.', 5, 0);

COMMENT ON TABLE app.setting_datalabel_form_submission_status IS 'Sequential state table for form submission workflow with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_form_submission_status.parent_id IS 'Most common preceding status in the submission flow. NULL for initial or independent states.';
