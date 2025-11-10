-- Orchestrator Session Table
-- Tracks multi-agent orchestration sessions with stateful workflow management
-- Part of the LLM Orchestration Framework

CREATE TABLE IF NOT EXISTS app.orchestrator_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  session_number varchar(50) UNIQUE NOT NULL

  -- Link to chat interaction
  chat_session_id uuid

  -- Authentication context
  user_id uuid
  tenant_id uuid
  auth_metadata jsonb DEFAULT '{}'::jsonb

  -- Intent and workflow state
  current_intent varchar(100), -- e.g., 'CalendarBooking', 'ComplaintHandling'
  current_node varchar(100), -- Current step in the intent graph
  intent_graph_version varchar(20) DEFAULT 'v1.0'

  -- Workflow status
  status varchar(50) DEFAULT 'active', -- 'active', 'paused', 'completed', 'failed'

  -- Session context (key entities)
  session_context jsonb DEFAULT '{}'::jsonb, -- {customer_id, booking_id, job_id, etc.}

  -- Conversation summaries for context retention
  conversation_summary text
  last_summary_ts timestamptz

  -- Metrics
  total_agent_calls integer DEFAULT 0
  total_mcp_calls integer DEFAULT 0
  total_tokens_used integer DEFAULT 0
  total_cost_cents integer DEFAULT 0

  -- Timestamps
  created_ts timestamptz DEFAULT now()
  updated_ts timestamptz DEFAULT now()
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
-- =====================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_agent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  session_id uuid REFERENCES app.orchestrator_session(id) ON DELETE CASCADE
  agent_role varchar(50),           -- 'orchestrator', 'worker', 'evaluator', 'critic'
  agent_action varchar(100),        -- 'process_message', 'execute_task', 'evaluate_result'
  node_context varchar(100),        -- Current workflow node

  -- Agent I/O
  input_data jsonb
  output_data jsonb

  -- LLM usage metrics
  model_used varchar(100),          -- e.g., 'gpt-3.5-turbo', 'gpt-4'
  tokens_used integer
  cost_cents integer

  -- MCP tool call details
  mcp_tool_name varchar(100),       -- e.g., 'customer_create', 'task_update'
  mcp_tool_args jsonb
  mcp_tool_result jsonb
  mcp_success boolean

  -- Execution results
  success boolean
  error_message text
  natural_response text
  duration_ms integer

  -- Timestamp
  created_ts timestamptz DEFAULT now()
);


-- Comments
COMMENT ON TABLE app.orchestrator_agent_log IS 'Detailed log of agent actions, LLM calls, and MCP tool executions';
COMMENT ON COLUMN app.orchestrator_agent_log.agent_role IS 'Type of agent: orchestrator, worker, evaluator, or critic';
COMMENT ON COLUMN app.orchestrator_agent_log.mcp_tool_name IS 'Name of MCP tool called (customer_create, task_update, etc.)';
COMMENT ON COLUMN app.orchestrator_agent_log.duration_ms IS 'Execution time in milliseconds';
-- =====================================================
-- Orchestrator State Table
-- Stores key-value state variables for each session
-- =====================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  session_id uuid REFERENCES app.orchestrator_session(id) ON DELETE CASCADE
  key varchar(100),                -- e.g., 'customer_id', 'booking_id', 'service_category'
  value jsonb,                     -- Flexible value storage
  value_type varchar(50),          -- e.g., 'string', 'number', 'boolean', 'object'
  source varchar(100),             -- Which node/agent set this value
  node_context varchar(100),       -- Current workflow node when set
  validated boolean,               -- Whether the value has been validated

  created_ts timestamptz DEFAULT now()
  updated_ts timestamptz DEFAULT now()

);


-- Comments
COMMENT ON TABLE app.orchestrator_state IS 'Key-value state storage for orchestrator sessions';
COMMENT ON COLUMN app.orchestrator_state.key IS 'State variable name (customer_id, service_category, etc.)';
COMMENT ON COLUMN app.orchestrator_state.value IS 'JSONB value for flexible storage';

-- =====================================================
-- Orchestrator Summary Table
-- Stores conversation summaries for context retention
-- =====================================================

CREATE TABLE IF NOT EXISTS app.orchestrator_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  session_id uuid REFERENCES app.orchestrator_session(id) ON DELETE CASCADE
  summary_type varchar(50),        -- 'full', 'incremental', 'node_completion'
  summary_text text,               -- LLM-generated summary
  up_to_node varchar(100),         -- Last node included in summary
  message_count integer,           -- Number of messages summarized
  model_used varchar(100),         -- Model used for summarization
  tokens_used integer,             -- Token count for summary generation

  created_ts timestamptz DEFAULT now()
);


-- Comments
COMMENT ON TABLE app.orchestrator_summary IS 'Conversation summaries for long-running sessions';
COMMENT ON COLUMN app.orchestrator_summary.summary_type IS 'Type of summary: full, incremental, or node_completion';
COMMENT ON COLUMN app.orchestrator_summary.summary_text IS 'LLM-generated natural language summary';
