-- ============================================================================
-- VII. OPPORTUNITY FUNNEL LEVEL SETTINGS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the stages of the sales opportunity funnel/pipeline for client
--   relationship management. Tracks potential clients as they progress through
--   the sales cycle from initial contact to closed deals. Essential for sales
--   forecasting, pipeline management, and conversion tracking.
--
-- Business Context:
--   Home services companies need to track potential clients through various
--   stages of the sales process. This table provides the framework for
--   categorizing opportunities and measuring conversion rates at each funnel stage.
--
-- Funnel Stages (typical B2C home services):
--   - Lead: Initial inquiry or contact from potential client
--   - Qualified: Lead has been vetted and meets service criteria
--   - Site Visit Scheduled: Appointment booked for assessment
--   - Proposal Sent: Quote or service proposal provided to client
--   - Negotiation: Discussing terms, pricing, or service details
--   - Contract Signed: Deal closed, client committed
--   - Lost: Opportunity did not convert to client
--   - On Hold: Temporarily paused, may revisit later
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
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_opportunity_funnel_level (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Opportunity funnel stages for Huron Home Services
-- Tracking potential clients through the sales pipeline

INSERT INTO app.setting_opportunity_funnel_level (level_id, level_name, level_descr, sort_order, active_flag) VALUES
(0, 'Lead', 'Initial contact or inquiry from potential client. Requires qualification and follow-up.', 0, true),
(1, 'Qualified', 'Lead has been vetted and meets service criteria. Ready for site visit or assessment.', 1, true),
(2, 'Site Visit Scheduled', 'Appointment booked for property assessment and service evaluation.', 2, true),
(3, 'Proposal Sent', 'Detailed quote or service proposal provided to client for review.', 3, true),
(4, 'Negotiation', 'Discussing terms, pricing adjustments, or service scope modifications.', 4, true),
(5, 'Contract Signed', 'Deal closed. Client has committed to services. Ready for onboarding.', 5, true),
(6, 'Lost', 'Opportunity did not convert. Client chose competitor or declined services.', 6, true),
(7, 'On Hold', 'Temporarily paused. Client may be seasonal or awaiting budget approval.', 7, true);
