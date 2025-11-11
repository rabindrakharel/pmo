-- Orchestrator Session Table
-- Tracks multi-agent orchestration sessions with stateful workflow management
-- Part of the LLM Orchestration Framework

CREATE TABLE IF NOT EXISTS app.orchestrator_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number varchar(50) UNIQUE NOT NULL,

  -- Link to chat interaction
  chat_session_id uuid,

  -- Authentication context
  user_id uuid,
  tenant_id uuid,
  auth_metadata jsonb DEFAULT '{}'::jsonb,

  -- Intent and workflow state
  current_intent varchar(100), -- e.g., 'CalendarBooking', 'ComplaintHandling'
  current_node varchar(100), -- Current step in the intent graph
  intent_graph_version varchar(20) DEFAULT 'v1.0',

  -- Workflow status
  status varchar(50) DEFAULT 'active', -- 'active', 'paused', 'completed', 'failed'

  -- Session context (key entities)
  session_context jsonb DEFAULT '{}'::jsonb, -- {customer_id, booking_id, job_id, etc.}

  -- Conversation summaries for context retention
  conversation_summary text,
  last_summary_ts timestamptz,

  -- Metrics
  total_agent_calls integer DEFAULT 0,
  total_mcp_calls integer DEFAULT 0,
  total_tokens_used integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,

  -- Timestamps
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  completed_ts timestamptz
);


-- Auto-update timestamp
CREATE TRIGGER orchestrator_session_updated_ts
  BEFORE UPDATE ON app.orchestrator_session
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_ts();

-- Comments
COMMENT ON TABLE app.orchestrator_session IS 'Multi-agent LLM orchestration sessions with stateful workflow tracking';
COMMENT ON COLUMN app.orchestrator_session.current_intent IS 'Selected intent graph (e.g., CalendarBooking, ComplaintHandling)';
COMMENT ON COLUMN app.orchestrator_session.current_node IS 'Current step/node in the intent graph workflow';
COMMENT ON COLUMN app.orchestrator_session.session_context IS 'Key entities and state variables for the session';
COMMENT ON COLUMN app.orchestrator_session.conversation_summary IS 'LLM-generated summary to maintain context with small models';

-- =====================================================
-- Orchestrator Agent Log Table
-- Logs individual agent actions and MCP tool calls
-- MOVED TO: XXXIX_orchestrator_agent_log.ddl (with improved constraints)
-- =====================================================
-- =====================================================
-- Orchestrator State Table
-- Stores key-value state variables for each session
-- MOVED TO: XXXVIII_orchestrator_state.ddl (with improved constraints)
-- =====================================================

-- =====================================================
-- Orchestrator Summary Table
-- Stores conversation summaries for context retention
-- MOVED TO: XL_orchestrator_summary.ddl (with improved constraints)
-- =====================================================
