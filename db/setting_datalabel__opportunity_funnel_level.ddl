-- ============================================================================
-- VII. OPPORTUNITY FUNNEL LEVEL SETTINGS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of sales opportunity progression through the
--   customer acquisition funnel. This is a SEQUENTIAL STATE table where each stage
--   represents a discrete phase in the sales pipeline. Stages form a graph-like
--   flow where transitions between states track the customer journey from initial
--   contact to closed deal or lost opportunity.
--
-- Sequential State Behavior:
--   - Sales opportunities progress through funnel stages in a generally linear fashion
--   - Allows branching to "Lost" or "On Hold" at multiple decision points
--   - "On Hold" opportunities can re-enter the funnel at appropriate stages
--   - Terminal states (Contract Signed, Lost) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Home services companies need to track potential clients through various
--   stages of the sales process. This table provides the framework for
--   categorizing opportunities and measuring conversion rates at each funnel stage.
--
-- Funnel Stages (typical B2C home services):
--   1. Lead: Initial inquiry or contact from potential client
--   2. Qualified: Lead has been vetted and meets service criteria
--   3. Site Visit Scheduled: Appointment booked for assessment
--   4. Proposal Sent: Quote or service proposal provided to client
--   5. Negotiation: Discussing terms, pricing, or service details
--   6. Contract Signed: Deal closed, client committed
--   7. Lost: Opportunity did not convert to client
--   8. On Hold: Temporarily paused, may revisit later
--
-- Typical State Transitions:
--   Lead -> Qualified -> Site Visit Scheduled -> Proposal Sent -> Negotiation -> Contract Signed
--   Proposal Sent -> Lost (client declined)
--   Negotiation -> On Hold -> Negotiation (resume after pause)
--   Any stage -> Lost (opportunity lost at any point)
--
-- Integration Points:
--   - d_client table uses opportunity_funnel_level_id to track client status
--   - Sales reporting and analytics rely on funnel stage data
--   - Marketing campaigns measure effectiveness by funnel progression
--   - Revenue forecasting based on opportunities at various stages
--
-- UI/UX Usage:
--   - Dropdown selector in client forms
--   - Kanban board for visual pipeline management
--   - Funnel conversion reports and analytics
--   - Sales dashboard metrics
--   - Sequential state visualizer component showing flow graph
--
-- Sequential State Visualization Pattern:
--   This table powers the SequentialStateVisualizer React component which renders
--   an interactive timeline showing client progression through the sales funnel.
--
--   Display Format: ● Lead → ● Qualified → ● Site Visit → ● **Proposal Sent** → ○ Negotiation → ○ Contract Signed
--   - Current stage: Blue circle with checkmark, ring effect, highlighted label
--   - Past stages: Light blue circles with checkmarks
--   - Future stages: Gray circles, dimmed labels
--   - Interactive: Click any stage to jump directly (in edit/create modes)
--
--   The component automatically detects this as a sequential field by matching
--   the 'funnel' and 'level' patterns in the field key ('opportunity_funnel_level_name').
--   Configuration is centralized in apps/web/src/lib/sequentialStateConfig.ts
--
--   Sort Order: The sort_order field determines left-to-right display sequence.
--   Typical sales funnel: 1=Lead, 2=Qualified, 3=Site Visit, 4=Proposal, 5=Negotiation, 6=Contract Signed
--
--   Integration:
--   - API endpoint: GET /api/v1/setting?category=opportunity_funnel_level
--   - Returns funnel stages with sort_order for sequential visualization
--   - Auto-replaces standard dropdown in EntityFormContainer component
--   - Provides visual sales pipeline context in client forms and detail pages
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_opportunity_funnel_level (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between funnel stages
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for opportunity funnel level
CREATE INDEX idx_opportunity_funnel_parent ON app.setting_datalabel_opportunity_funnel_level(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Opportunity funnel stages for Huron Home Services
-- Tracking potential clients through the sales pipeline
-- parent_id represents the most common preceding stage (null for initial states)

INSERT INTO app.setting_datalabel_opportunity_funnel_level (level_id, level_name, level_descr, sort_order, parent_id, active_flag) VALUES
(0, 'Lead', 'Initial contact or inquiry from potential client. Requires qualification and follow-up.', 0, NULL, true),
(1, 'Qualified', 'Lead has been vetted and meets service criteria. Ready for site visit or assessment.', 1, 0, true),
(2, 'Site Visit Scheduled', 'Appointment booked for property assessment and service evaluation.', 2, 1, true),
(3, 'Proposal Sent', 'Detailed quote or service proposal provided to client for review.', 3, 2, true),
(4, 'Negotiation', 'Discussing terms, pricing adjustments, or service scope modifications.', 4, 3, true),
(5, 'Contract Signed', 'Deal closed. Client has committed to services. Ready for onboarding. Terminal state.', 5, 4, true),
(6, 'Lost', 'Opportunity did not convert. Client chose competitor or declined services. Terminal state.', 6, NULL, true),
(7, 'On Hold', 'Temporarily paused. Client may be seasonal or awaiting budget approval. Can resume to previous stages.', 7, 4, true);

COMMENT ON TABLE app.setting_datalabel_opportunity_funnel_level IS 'Sequential state table for sales opportunity funnel stages with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_opportunity_funnel_level.parent_id IS 'Most common preceding stage in the funnel flow. NULL for initial or independent states.';
