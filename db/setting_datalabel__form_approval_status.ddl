-- ============================================================================
-- SETTING: FORM APPROVAL STATUS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of form approval workflow. This is a
--   SEQUENTIAL STATE table where each status represents a discrete phase in the
--   approval process. Statuses form a graph-like flow tracking forms from initial
--   submission through review and approval or rejection by authorized personnel.
--
-- Sequential State Behavior:
--   - Forms progress through approval workflow stages
--   - Allows branching (pending -> approved/rejected/conditional/escalated)
--   - Circular transitions possible (conditional -> pending for resubmission)
--   - Terminal states (approved, rejected) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Approval workflow management for business forms and documents:
--   1. Pending: Awaiting initial review by approver
--   2. Conditional: Approved with conditions requiring changes
--   3. Escalated: Escalated to higher authority for decision
--   4. Approved: Final approval granted by authorized person
--   5. Rejected: Does not meet criteria, approval denied
--
-- Typical State Transitions:
--   pending -> approved (straightforward approval)
--   pending -> rejected (does not meet criteria)
--   pending -> conditional (approved with required changes)
--   pending -> escalated (requires higher authority)
--   conditional -> pending (resubmitted after changes)
--   escalated -> approved (higher authority approves)
--   escalated -> rejected (higher authority rejects)
--
-- Integration Points:
--   - d_form_data.approval_status references this table
--   - Approval workflow automation triggers notifications
--   - Business rules determine escalation thresholds
--   - Audit trails track status transition history
--
-- UI/UX Usage:
--   - Status dropdown in form review interfaces
--   - Status badges in approval queues with color coding
--   - Approval dashboard showing pending items
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing form approval progression through decision workflow.
--
--   Display Format: ● Pending → ● **Under Review** → ○ Approved → ○ Rejected
--   - Current status: Blue circle with checkmark, ring effect, highlighted label
--   - Past statuses: Light blue circles with checkmarks
--   - Future statuses: Gray circles, dimmed labels
--   - Interactive: Click any status to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'status' pattern in the field key ('approval_status'). Configuration
--   is centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Approval workflow: 1=Pending, 2=Under Review, 3=Approved, 4=Rejected
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=form_approval_status
--   - Returns statuses with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual approval workflow context in form review interfaces and detail pages
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_form_approval_status (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between statuses
    is_active boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for form approval status
CREATE INDEX idx_form_approval_parent ON app.setting_datalabel_form_approval_status(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Form approval status values with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding status (null for initial states)

INSERT INTO app.setting_datalabel_form_approval_status (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'pending', 'Pending approval - awaiting review by authorized approver. Initial entry point.', 0, NULL),
(1, 'approved', 'Approved by authorized person. Final approval granted. Terminal state.', 1, 0),
(2, 'rejected', 'Rejected - does not meet approval criteria. Approval denied. Terminal state.', 2, 0),
(3, 'conditional', 'Conditionally approved - requires specific changes before final approval.', 3, 0),
(4, 'escalated', 'Escalated to higher authority for decision. Requires senior review.', 4, 0);

COMMENT ON TABLE app.setting_datalabel_form_approval_status IS 'Sequential state table for form approval workflow with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_form_approval_status.parent_id IS 'Most common preceding status in the approval flow. NULL for initial or independent states.';
