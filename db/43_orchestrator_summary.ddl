-- =====================================================
-- ORCHESTRATOR CONVERSATION SUMMARY TABLE
-- LLM-generated summaries to maintain context with small token models
-- Part of the LLM Orchestration Framework
-- =====================================================
--
-- RELATIONSHIPS (NO FOREIGN KEYS - Platform Pattern):
-- • session_id → orchestrator_session (application-level integrity)
--
-- =====================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,  -- Parent session reference (no FK - platform pattern)

  -- Summary details
  summary_type varchar(50), -- 'full', 'incremental', 'node_completion'
  summary_text text,

  -- Context
  up_to_node varchar(100), -- Which node this summary covers up to
  message_count integer, -- How many messages were summarized

  -- Metadata
  model_used varchar(100),
  tokens_used integer,

  -- Timestamps
  created_ts timestamptz DEFAULT now()
);


-- Comments
COMMENT ON TABLE app.orchestrator_summary IS 'LLM-generated conversation summaries for context retention';
COMMENT ON COLUMN app.orchestrator_summary.summary_type IS 'Type of summary: full (entire conversation), incremental (last N messages), node_completion (after completing a graph node)';
