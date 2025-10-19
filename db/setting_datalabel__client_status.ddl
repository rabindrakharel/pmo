-- ============================================================================
-- SETTING: CLIENT STATUS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines the sequential states of client relationship lifecycle. This is a
--   SEQUENTIAL STATE table where each status represents a discrete phase in the
--   customer relationship management workflow. Statuses form a graph-like flow
--   tracking clients from prospects through active engagement to churn or archive.
--
-- Sequential State Behavior:
--   - Clients typically progress from prospect -> active -> inactive/archived
--   - Allows circular transitions (e.g., inactive -> active for re-engagement)
--   - Multiple exit paths (churned, archived, suspended)
--   - Terminal states (churned, archived) typically have no forward transitions
--   - parent_id field enables graph-like relationships for workflow visualization
--
-- Business Context:
--   Customer lifecycle management for home services:
--   1. Prospect: Potential client in sales funnel, not yet converted
--   2. Active: Current client with ongoing business relationship
--   3. Inactive: Former client with no current engagement but relationship maintained
--   4. Suspended: Temporary hold on services (billing issues, seasonal pause)
--   5. Churned: Client lost to competition or chose to discontinue
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
--   - d_client.client_status references this table
--   - Customer health scoring based on status transitions
--   - Retention campaigns triggered by status changes
--   - Revenue forecasting excludes churned/archived clients
--
-- UI/UX Usage:
--   - Status dropdown in client forms
--   - Status badges in client lists with color coding
--   - Client lifecycle reports and dashboards
--   - Sequential state visualizer component showing flow graph
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_client_status (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    parent_id integer, -- Enables graph-like flow relationships between statuses
    is_active boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for client status
CREATE INDEX idx_client_status_parent ON app.setting_datalabel_client_status(parent_id);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Client status values with parent_id relationships showing typical flow graph
-- parent_id represents the most common preceding status (null for initial states)

INSERT INTO app.setting_datalabel_client_status (level_id, level_name, level_descr, sort_order, parent_id) VALUES
(0, 'active', 'Active client with ongoing business relationship. Primary revenue-generating status.', 0, 2),
(1, 'inactive', 'Inactive client with no current engagement. Relationship maintained for re-engagement.', 1, 0),
(2, 'prospect', 'Prospective client in sales funnel, not yet converted. Initial entry point.', 2, NULL),
(3, 'archived', 'Archived client - historical record only. No future business expected. Terminal state.', 3, 1),
(4, 'suspended', 'Suspended - temporary hold on services due to billing issues or seasonal pause.', 4, 0),
(5, 'churned', 'Churned - client lost to competition or chose to discontinue services. Terminal state.', 5, 4);

COMMENT ON TABLE app.setting_datalabel_client_status IS 'Sequential state table for client relationship lifecycle with graph-like flow relationships';
COMMENT ON COLUMN app.setting_datalabel_client_status.parent_id IS 'Most common preceding status in the lifecycle flow. NULL for initial or independent states.';
