-- Orchestrator State Variables Table
-- Key-value store for session variables, collected data, and intermediate results
-- Part of the LLM Orchestration Framework

CREATE TABLE IF NOT EXISTS app.orchestrator_state (
  id uuid DEFAULT gen_random_uuid(),
  session_id uuid,

  -- State variable
  key varchar(100), -- e.g., 'customer_name', 'desired_date', 'available_slots'
  value jsonb, -- Flexible storage for any type of value
  value_type varchar(50), -- 'string', 'number', 'boolean', 'object', 'array'

  -- Metadata
  source varchar(100), -- Which agent/tool produced this value
  node_context varchar(100), -- Which graph node this relates to
  validated boolean DEFAULT false, -- Whether Evaluator has validated this

  -- Timestamps
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Comments
COMMENT ON TABLE app.orchestrator_state IS 'Key-value store for orchestrator session state variables';
COMMENT ON COLUMN app.orchestrator_state.key IS 'State variable name (e.g., customer_name, desired_date)';
COMMENT ON COLUMN app.orchestrator_state.validated IS 'Whether Evaluator agent has validated this value';
