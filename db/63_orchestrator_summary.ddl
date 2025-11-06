-- Orchestrator Conversation Summary Table
-- LLM-generated summaries to maintain context with small token models
-- Part of the LLM Orchestration Framework

CREATE TABLE IF NOT EXISTS app.orchestrator_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app.orchestrator_session(id) ON DELETE CASCADE,

  -- Summary details
  summary_type varchar(50) NOT NULL, -- 'full', 'incremental', 'node_completion'
  summary_text text NOT NULL,

  -- Context
  up_to_node varchar(100), -- Which node this summary covers up to
  message_count integer, -- How many messages were summarized

  -- Metadata
  model_used varchar(100),
  tokens_used integer,

  -- Timestamps
  created_ts timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orchestrator_summary_session ON app.orchestrator_summary(session_id);
CREATE INDEX idx_orchestrator_summary_created ON app.orchestrator_summary(session_id, created_ts DESC);

-- Comments
COMMENT ON TABLE app.orchestrator_summary IS 'LLM-generated conversation summaries for context retention';
COMMENT ON COLUMN app.orchestrator_summary.summary_type IS 'Type of summary: full (entire conversation), incremental (last N messages), node_completion (after completing a graph node)';
