-- Orchestrator State Variables Table
-- Key-value store for session variables, collected data, and intermediate results
-- Part of the LLM Orchestration Framework

CREATE TABLE IF NOT EXISTS app.orchestrator_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app.orchestrator_session(id) ON DELETE CASCADE,

  -- State variable
  key varchar(100) NOT NULL, -- e.g., 'customer_name', 'desired_date', 'available_slots'
  value jsonb NOT NULL, -- Flexible storage for any type of value
  value_type varchar(50), -- 'string', 'number', 'boolean', 'object', 'array'

  -- Metadata
  source varchar(100), -- Which agent/tool produced this value
  node_context varchar(100), -- Which graph node this relates to
  validated boolean DEFAULT false, -- Whether Evaluator has validated this

  -- Timestamps
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orchestrator_state_session ON app.orchestrator_state(session_id);
CREATE INDEX idx_orchestrator_state_key ON app.orchestrator_state(key);
-- Unique constraint to prevent duplicate state keys per session
ALTER TABLE app.orchestrator_state ADD CONSTRAINT orchestrator_state_session_id_key_key UNIQUE (session_id, key);

-- Auto-update timestamp
CREATE TRIGGER orchestrator_state_updated_ts
  BEFORE UPDATE ON app.orchestrator_state
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_ts();

-- Comments
COMMENT ON TABLE app.orchestrator_state IS 'Key-value store for orchestrator session state variables';
COMMENT ON COLUMN app.orchestrator_state.key IS 'State variable name (e.g., customer_name, desired_date)';
COMMENT ON COLUMN app.orchestrator_state.validated IS 'Whether Evaluator agent has validated this value';
