-- ============================================================================
-- SETTING: CUSTOMER STATUS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of customer relationship lifecycle. This is a
--   SEQUENTIAL STATE table where each status represents a discrete phase in the
--   customer relationship management workflow. Statuses form a graph-like flow
--   tracking customers from prospects through active engagement to churn or archive.
--
-- Sequential State Behavior:
--   - Customers typically progress from prospect -> active -> inactive/archived
--   - Allows circular transitions (e.g., inactive -> active for re-engagement)
--   - Multiple exit paths (churned, archived, suspended)
--   - Terminal states (churned, archived) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Customer lifecycle management for home services:
--   1. Prospect: Potential customer in sales funnel, not yet converted
--   2. Active: Current customer with ongoing business relationship
--   3. Inactive: Former customer with no current engagement but relationship maintained
--   4. Suspended: Temporary hold on services (billing issues, seasonal pause)
--   5. Churned: Customer lost to competition or chose to discontinue
--   6. Archived: Historical record only, no future business expected
--
-- Typical State Transitions:
--   prospect -> active (conversion from sales funnel)
--   active -> inactive (natural disengagement)
--   active -> suspended (temporary service hold)
--   inactive -> active (re-engagement campaign success)
--   suspended -> active (issue resolved)
--   suspended -> churned (unresolved issues lead to loss)
--   inactive -> archived (long-term dormancy)
--
-- Integration Points:
--   - d_cust.cust_status references this table
--   - Customer health scoring based on status transitions
--   - Retention campaigns triggered by status changes
--   - Revenue forecasting excludes churned/archived customers
--
-- UI/UX Usage:
--   - Status dropdown in customer forms
--   - Status badges in customer lists with color coding
--   - Customer lifecycle reports and dashboards
--   - Sequential state visualizer component showing flow graph
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_cust_status (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between statuses
    is_active boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for customer status
CREATE INDEX idx_cust_status_parent ON app.setting_datalabel_cust_status(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Customer status values with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding status (null for initial states)

INSERT INTO app.setting_datalabel_cust_status (level_id, name, descr, sort_order, parent_id) VALUES
(0, 'active', 'Active customer with ongoing business relationship. Primary revenue-generating status.', 0, 2),
(1, 'inactive', 'Inactive customer with no current engagement. Relationship maintained for re-engagement.', 1, 0),
(2, 'prospect', 'Prospective customer in sales funnel, not yet converted. Initial entry point.', 2, NULL),
(3, 'archived', 'Archived customer - historical record only. No future business expected. Terminal state.', 3, 1),
(4, 'suspended', 'Suspended - temporary hold on services due to billing issues or seasonal pause.', 4, 0),
(5, 'churned', 'Churned - customer lost to competition or chose to discontinue services. Terminal state.', 5, 4);

COMMENT ON TABLE app.setting_datalabel_cust_status IS 'Sequential state table for customer relationship lifecycle with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_cust_status.parent_id IS 'Most common preceding status in the lifecycle flow. NULL for initial or independent states.';
