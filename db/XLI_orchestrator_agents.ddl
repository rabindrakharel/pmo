/**
 * Multi-Agent Orchestrator Extension
 * Adds circuit breaker, agent execution tracking, and checkpointing
 * Dependencies: 30_orchestrator.ddl
 */

-- ============================================================================
-- Agent Execution Tracking
-- Tracks every agent invocation with input/output
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_agent_execution (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES app.orchestrator_session(id) ON DELETE CASCADE,
  agent_type text NOT NULL, -- 'planner', 'worker', 'critic', 'summarizer', 'orchestrator'
  execution_order int NOT NULL, -- Sequential order within session

  -- Input/Output
  input_state jsonb NOT NULL,
  output_state jsonb,
  decision jsonb, -- For planner decisions

  -- Status tracking
  status text NOT NULL, -- 'running', 'success', 'failed', 'skipped'
  error_details jsonb,
  retry_count int DEFAULT 0,

  -- Performance metrics
  duration_ms int,
  tokens_used int,
  cost_cents numeric(10, 2),

  -- Timestamps
  created_ts timestamptz NOT NULL DEFAULT now(),
  completed_ts timestamptz

  -- Indexes
);


COMMENT ON TABLE app.orchestrator_agent_execution IS 'Tracks every agent invocation for audit and debugging';
COMMENT ON COLUMN app.orchestrator_agent_execution.execution_order IS 'Sequential order of execution within session';
COMMENT ON COLUMN app.orchestrator_agent_execution.decision IS 'Planner agent decisions with reasoning';

-- ============================================================================
-- Circuit Breaker State
-- Prevents infinite loops and cascading failures
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_circuit_breaker (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES app.orchestrator_session(id) ON DELETE CASCADE,
  agent_type text NOT NULL,

  -- Failure tracking
  failure_count int NOT NULL DEFAULT 0,
  last_failure_ts timestamptz,
  failure_threshold int NOT NULL DEFAULT 3,

  -- Circuit state
  circuit_state text NOT NULL, -- 'closed', 'open', 'half_open'
  opened_ts timestamptz,
  timeout_ms int NOT NULL DEFAULT 60000, -- 60 seconds default

  -- Reset tracking
  last_success_ts timestamptz,
  consecutive_successes int DEFAULT 0,

  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now()

);


COMMENT ON TABLE app.orchestrator_circuit_breaker IS 'Circuit breaker pattern for agent failure handling';
COMMENT ON COLUMN app.orchestrator_circuit_breaker.circuit_state IS 'closed=normal, open=failing, half_open=testing';

-- ============================================================================
-- Conversation Checkpoints
-- Allows rollback on failure
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_checkpoint (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES app.orchestrator_session(id) ON DELETE CASCADE,

  -- Checkpoint identification
  checkpoint_name text NOT NULL,
  workflow_state text NOT NULL,

  -- State snapshot
  state_snapshot jsonb NOT NULL,
  variables_snapshot jsonb NOT NULL,

  -- Metadata
  description text,
  created_by text DEFAULT 'system',
  created_ts timestamptz NOT NULL DEFAULT now()
);


COMMENT ON TABLE app.orchestrator_checkpoint IS 'Conversation checkpoints for rollback capability';
COMMENT ON COLUMN app.orchestrator_checkpoint.workflow_state IS 'State machine state at checkpoint time';

-- ============================================================================
-- Extend orchestrator_session table
-- Add workflow state machine fields
-- ============================================================================

-- Add new columns to orchestrator_session if they don't exist
DO $$
BEGIN
  -- Workflow state machine
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'workflow_state') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN workflow_state text DEFAULT 'greeting';
  END IF;

  -- Retry tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'max_retries') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN max_retries int DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'current_retry_count') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN current_retry_count int DEFAULT 0;
  END IF;

  -- Checkpoint reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'last_checkpoint_id') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN last_checkpoint_id uuid REFERENCES app.orchestrator_checkpoint(id);
  END IF;

  -- Failure mode tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'failure_mode') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN failure_mode text;
  END IF;

  -- Fallback flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app'
                 AND table_name = 'orchestrator_session'
                 AND column_name = 'fallback_mode') THEN
    ALTER TABLE app.orchestrator_session
      ADD COLUMN fallback_mode boolean DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN app.orchestrator_session.workflow_state IS 'Current state in workflow state machine';
COMMENT ON COLUMN app.orchestrator_session.failure_mode IS 'Type of failure: circuit_open, max_retries, validation_error, etc.';
COMMENT ON COLUMN app.orchestrator_session.fallback_mode IS 'True if operating in manual fallback mode';

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get last checkpoint for session
CREATE OR REPLACE FUNCTION app.get_last_checkpoint(p_session_id uuid)
RETURNS app.orchestrator_checkpoint AS $$
  SELECT * FROM app.orchestrator_checkpoint
  WHERE session_id = p_session_id
  ORDER BY created_ts DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to check if circuit breaker is open
CREATE OR REPLACE FUNCTION app.is_circuit_open(p_session_id uuid, p_agent_type text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.orchestrator_circuit_breaker
    WHERE session_id = p_session_id
    AND agent_type = p_agent_type
    AND circuit_state = 'open'
    AND (EXTRACT(EPOCH FROM (now() - opened_ts)) * 1000) < timeout_ms
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION app.get_last_checkpoint IS 'Retrieves the most recent checkpoint for a session';
COMMENT ON FUNCTION app.is_circuit_open IS 'Checks if circuit breaker is currently open for an agent';

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- No sample data for these tables - they are populated during runtime
