# AI Chat System - Complete Technical Reference

**Version:** 2.0.0 | **Status:** Production | **Last Updated:** 2025-11-06

> **Audience:** Staff architects and engineers implementing or extending the AI chat system
>
> **Framework:** LangGraph v2.0 | **Model:** GPT-3.5 Turbo | **Cost:** ~$0.016/conversation

---

## Table of Contents

1. [Semantics & Business Context](#1-semantics--business-context)
2. [Architecture & DRY Design Patterns](#2-architecture--dry-design-patterns)
3. [Database, API & UI/UX Mapping](#3-database-api--uiux-mapping)
4. [Entity Relationships](#4-entity-relationships)
5. [Central Configuration & Middleware](#5-central-configuration--middleware)
6. [User Interaction Flow Examples](#6-user-interaction-flow-examples)
7. [Critical Considerations When Building](#7-critical-considerations-when-building)

---

## 1. Semantics & Business Context

### Purpose

The AI Chat System provides intelligent, cost-effective conversational interfaces for PMO platform users through:
- **Text chat** via HTTP/WebSocket
- **Voice chat** via push-to-talk audio processing
- **Multi-agent orchestration** for reliable workflow execution
- **MCP tool integration** for accessing 60+ PMO API functions

### Business Problems Solved

**Traditional Chatbot Limitations:**
- ❌ Context loss over long conversations
- ❌ Topic drift and hallucinations
- ❌ Incomplete task execution
- ❌ No quality control
- ❌ High costs with GPT-4

**Our Solution:**
- ✅ **Stateful orchestration** - PostgreSQL stores all session state
- ✅ **Multi-agent coordination** - Specialized agents (Orchestrator, Worker, Evaluator, Critic) enforce quality
- ✅ **LangGraph framework** - Industry-standard workflow engine
- ✅ **GPT-3.5 Turbo** - 94.7% cost reduction vs alternatives
- ✅ **MCP protocol** - Secure tool calling with JWT auth
- ✅ **Conversation boundaries** - Auto-detect off-topic and end gracefully

### Core Value Proposition

**Run GPT-3.5 Turbo (cheap) with reliability comparable to GPT-4 (expensive) through orchestration, not model size.**

**Cost:** ~$0.016 per conversation (text or voice)
**Savings:** 94.7% vs OpenAI Realtime API ($0.30/conversation)

---

## 2. Architecture & DRY Design Patterns

### System Block Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (React 19 / Web / Mobile)                               │
│                                                                  │
│  ┌──────────────────┐           ┌─────────────────────────────┐│
│  │ Text Chat        │           │ Voice Chat                   ││
│  │ HTTP POST        │           │ MediaRecorder → Audio Upload ││
│  │ /langgraph/msg   │           │ /orchestrator/voice          ││
│  └────────┬─────────┘           └────────┬────────────────────┘│
└───────────┼──────────────────────────────┼──────────────────────┘
            │                              │
            │ Bearer: JWT                  │ multipart/form-data
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASTIFY API SERVER                                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 1: AUTHENTICATION                                    │  │
│  │  - JWT decode (user_id, tenant_id, roles, permissions)   │  │
│  │  - Permission check (intent-level + MCP tool-level)      │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 2: SPEECH-TO-TEXT (Voice Only)                      │  │
│  │  - OpenAI Whisper API (whisper-1)                        │  │
│  │  - Cost: $0.006/minute                                   │  │
│  │  - Latency: 500-1500ms                                   │  │
│  │  - Output: "I need landscaping service"                  │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 3: LANGGRAPH MULTI-AGENT ORCHESTRATOR               │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ StateGraph: CalendarBooking                         │ │  │
│  │  │                                                      │ │  │
│  │  │  Nodes:                                             │ │  │
│  │  │  ├─ entry (intent detection)                       │ │  │
│  │  │  ├─ critic (boundary check)                        │ │  │
│  │  │  ├─ identify_customer                              │ │  │
│  │  │  ├─ welcome_existing / create_customer            │ │  │
│  │  │  ├─ gather_booking_requirements                   │ │  │
│  │  │  ├─ find_available_slots                          │ │  │
│  │  │  ├─ propose_options                               │ │  │
│  │  │  ├─ create_booking                                │ │  │
│  │  │  └─ confirm_and_summarize                         │ │  │
│  │  │                                                      │ │  │
│  │  │  Edges: Conditional routing based on state         │ │  │
│  │  │                                                      │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  Model Configuration (all agents use GPT-3.5 Turbo):     │  │
│  │  ├─ Orchestrator: gpt-3.5-turbo, temp=0.3, max=1000    │  │
│  │  ├─ Worker: gpt-3.5-turbo, temp=0.7, max=1500          │  │
│  │  ├─ Evaluator: gpt-3.5-turbo, temp=0.1, max=500        │  │
│  │  └─ Critic: gpt-3.5-turbo, temp=0.2, max=500           │  │
│  │                                                            │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 4: MCP TOOL EXECUTION (as needed)                   │  │
│  │  - customer_create, customer_update, customer_list       │  │
│  │  - task_create, task_update, task_list                   │  │
│  │  - employee_list, availability_check                     │  │
│  │  - linkage_create (entity relationships)                 │  │
│  │  - 60+ total tools, all with JWT auth                    │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 5: STATE PERSISTENCE (PostgreSQL)                   │  │
│  │  - orchestrator_session (session metadata)               │  │
│  │  - orchestrator_state (key-value variables)              │  │
│  │  - orchestrator_agent_log (audit trail)                  │  │
│  │  - orchestrator_summary (context summaries)              │  │
│  │  - Checkpointing: After every node execution             │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STEP 6: TEXT-TO-SPEECH (Voice Only)                      │  │
│  │  - OpenAI TTS API (tts-1 model)                          │  │
│  │  - Voice: nova/alloy/echo/fable/onyx/shimmer             │  │
│  │  - Cost: $0.015/1M characters                            │  │
│  │  - Latency: 500-1500ms                                   │  │
│  │  - Output: MP3 audio stream                              │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  RESPONSE TO CLIENT                                              │
│                                                                  │
│  Text Chat: JSON { sessionId, response, intent, ... }           │
│  Voice Chat: MP3 audio + metadata headers                       │
└─────────────────────────────────────────────────────────────────┘
```

### DRY Pattern: LangGraph StateGraph

**Problem:** Hard-coding workflows in code requires redeployment for changes.

**Solution:** Declarative state graphs as composable node functions.

```typescript
// Intent graph as LangGraph StateGraph
export function createCalendarBookingGraph(mcpAdapter: MCPAdapter) {
  const graph = new StateGraph(OrchestratorStateAnnotation)
    // Add nodes
    .addNode('entry', entryNode)
    .addNode('critic', criticNode)
    .addNode('identify_customer', identifyCustomerNode)
    .addNode('create_customer', createCustomerNode)
    .addNode('gather_booking_requirements', gatherBookingNode)
    .addNode('create_booking', createBookingNode)
    .addNode('confirm_and_summarize', confirmNode)

    // Define edges
    .addEdge(START, 'entry')
    .addEdge('entry', 'critic')
    .addConditionalEdges('critic', routeAfterCritic)
    .addConditionalEdges('identify_customer', routeAfterIdentify)
    .addConditionalEdges('create_booking', routeAfterBooking)
    .addEdge('confirm_and_summarize', END);

  // Compile with PostgreSQL checkpointer
  return graph.compile({ checkpointer: postgresCheckpointer });
}
```

**New intent = New graph file, register in service, zero core code changes.**

### DRY Pattern: PostgreSQL Checkpointer

**Problem:** LangGraph's default in-memory checkpointer loses state on restart.

**Solution:** Custom PostgreSQL checkpointer using existing `orchestrator_state` table.

```typescript
// Automatic state persistence after each node
class PostgresCheckpointer extends BaseCheckpointSaver {
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    // Load from orchestrator_state table
    const state = await db.query(`
      SELECT key, value FROM orchestrator_state
      WHERE session_id = $1
    `, [config.configurable.thread_id]);

    return { checkpoint: stateToCheckpoint(state), ... };
  }

  async putTuple(checkpoint: Checkpoint, config: RunnableConfig): Promise<void> {
    // Save to orchestrator_state table
    await db.query(`
      INSERT INTO orchestrator_state (session_id, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (session_id, key) DO UPDATE SET value = $3
    `, [config.configurable.thread_id, key, value]);
  }
}
```

### DRY Pattern: Agent-Specific Model Configuration

**Problem:** Using GPT-4 for all agents wastes money on simple tasks.

**Solution:** Configure models per agent role with environment variable overrides.

```typescript
// config/agent-models.config.ts
export const AGENT_MODEL_CONFIG = {
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1000,
    costPer1KTokens: 0.0015
  },
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1500,
    costPer1KTokens: 0.0015
  },
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  },
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  }
};

// Runtime override
export function setAgentModel(agent: AgentRole, model: string, temp: number) {
  AGENT_MODEL_CONFIG[agent].model = model;
  AGENT_MODEL_CONFIG[agent].temperature = temp;
}
```

### DRY Pattern: MCP Adapter with Dynamic Fields

**Problem:** API endpoints evolve, hard-coding parameters breaks tool calls.

**Solution:** Dynamic body field extraction with wildcard support.

```typescript
// MCP adapter supports body_* pattern for any field
// API manifest:
{
  name: 'customer_update',
  method: 'PUT',
  path: '/api/v1/cust/:id',
  parameters: {
    path: { id: 'Customer UUID' },
    body: { '*': 'Any customer field (incremental updates)' }
  }
}

// LLM can call with any fields:
customer_update({
  customer_id: 'uuid',
  body_primary_address: '123 Main St',  // Extracted to body.primary_address
  body_city: 'Toronto',                 // Extracted to body.city
  body_postal_code: 'M5H 2N2'          // Extracted to body.postal_code
})

// Adapter extracts body_* → request body automatically
```

---

## 3. Database, API & UI/UX Mapping

### Database Schema

#### Table: `orchestrator_session`

**Purpose:** Tracks orchestration session lifecycle and workflow state.

```sql
CREATE TABLE app.orchestrator_session (
  id uuid PRIMARY KEY,
  session_number varchar(50) UNIQUE,

  -- Link to chat interaction
  chat_session_id uuid,

  -- Authentication
  user_id uuid,
  tenant_id uuid,
  auth_metadata jsonb,

  -- Workflow state
  current_intent varchar(100),      -- 'CalendarBooking'
  current_node varchar(100),        -- 'gather_booking_requirements'
  intent_graph_version varchar(20), -- 'v1.0'
  status varchar(50),               -- 'active', 'paused', 'completed', 'failed'

  -- Context
  session_context jsonb,            -- {customer_id, task_id, ...}
  conversation_summary text,        -- LLM-generated summary

  -- Metrics
  total_agent_calls integer,
  total_mcp_calls integer,
  total_tokens_used integer,
  total_cost_cents integer,

  -- Timestamps
  created_ts timestamptz,
  updated_ts timestamptz,
  completed_ts timestamptz
);

CREATE INDEX idx_orchestrator_session_chat_id ON orchestrator_session(chat_session_id);
CREATE INDEX idx_orchestrator_session_user ON orchestrator_session(user_id);
CREATE INDEX idx_orchestrator_session_status ON orchestrator_session(status);
CREATE INDEX idx_orchestrator_session_intent ON orchestrator_session(current_intent);
```

**Use:** Track active sessions, resume conversations, measure performance

#### Table: `orchestrator_state`

**Purpose:** Key-value store for session variables (LangGraph checkpointing).

```sql
CREATE TABLE app.orchestrator_state (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,

  key varchar(100),           -- 'customer_name', 'desired_date', etc.
  value jsonb,                -- Any type
  value_type varchar(50),     -- 'string', 'number', 'boolean', 'object'

  source varchar(100),        -- Which node/agent set this
  node_context varchar(100),  -- Current workflow node
  validated boolean,          -- Evaluator marked as valid

  created_ts timestamptz,
  updated_ts timestamptz,

  UNIQUE(session_id, key)
);

CREATE INDEX idx_orchestrator_state_session ON orchestrator_state(session_id);
CREATE INDEX idx_orchestrator_state_key ON orchestrator_state(session_id, key);
```

**Use:** Store workflow variables, enable session resumption, LangGraph checkpointing

#### Table: `orchestrator_agent_log`

**Purpose:** Complete audit trail of agent actions and MCP tool calls.

```sql
CREATE TABLE app.orchestrator_agent_log (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,

  agent_role varchar(50),      -- 'orchestrator', 'worker', 'evaluator', 'critic'
  agent_action varchar(100),   -- 'execute_mcp_call', 'validate_node', etc.
  node_context varchar(100),

  -- Agent I/O
  input_data jsonb,
  output_data jsonb,

  -- LLM metrics
  model_used varchar(100),     -- 'gpt-3.5-turbo'
  tokens_used integer,
  cost_cents integer,

  -- MCP details
  mcp_tool_name varchar(100),  -- 'customer_create', 'task_update'
  mcp_tool_args jsonb,
  mcp_tool_result jsonb,
  mcp_success boolean,

  -- Results
  success boolean,
  error_message text,
  natural_response text,
  duration_ms integer,

  created_ts timestamptz
);

CREATE INDEX idx_orchestrator_agent_log_session ON orchestrator_agent_log(session_id);
CREATE INDEX idx_orchestrator_agent_log_role ON orchestrator_agent_log(agent_role);
CREATE INDEX idx_orchestrator_agent_log_created ON orchestrator_agent_log(created_ts);
```

**Use:** Debugging, compliance audits, performance analysis, cost tracking

#### Table: `orchestrator_summary`

**Purpose:** LLM-generated conversation summaries (reduces context window).

```sql
CREATE TABLE app.orchestrator_summary (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,

  summary_type varchar(50),   -- 'full', 'incremental', 'node_completion'
  summary_text text,          -- LLM-generated summary
  up_to_node varchar(100),    -- Last node included
  message_count integer,
  model_used varchar(100),
  tokens_used integer,

  created_ts timestamptz
);

CREATE INDEX idx_orchestrator_summary_session ON orchestrator_summary(session_id);
```

**Pattern:** Generate summary every 10 messages, pass to LLM instead of full history.

---

### API Endpoints

#### Text Chat (LangGraph)

```
POST /api/v1/chat/langgraph/message
  Body: { session_id?, message, chat_session_id?, user_id? }
  Response: {
    sessionId, response, intent, currentNode,
    requiresUserInput, completed, conversationEnded, endReason
  }

GET /api/v1/chat/langgraph/session/:id/status
  Response: { session, state, logs }

GET /api/v1/chat/langgraph/intents
  Response: { count, intents[] }

GET /api/v1/chat/langgraph/health
  Response: { status, framework: 'langgraph' }
```

#### Voice Chat (Orchestrator + Whisper + TTS)

```
POST /api/v1/chat/orchestrator/voice
  Content-Type: multipart/form-data
  Fields: { file: audioBlob, session_id?, voice: 'nova' }
  Response: Audio/MP3 stream
  Headers:
    X-Session-Id: uuid
    X-Transcript: URL-encoded user speech
    X-Response-Text: URL-encoded bot response
    X-Intent: CalendarBooking
    X-Current-Node: gather_booking_requirements
    X-Completed: true/false
    X-Conversation-Ended: true/false
    X-End-Reason: off_topic | max_turns | completed

POST /api/v1/chat/orchestrator/stt
  Response: { transcript }

POST /api/v1/chat/orchestrator/tts
  Body: { text, voice? }
  Response: Audio/MP3

GET /api/v1/chat/orchestrator/voices
  Response: { voices: [alloy, echo, fable, onyx, nova, shimmer] }
```

---

### UI/UX Mapping

#### Frontend: Text Chat

**File:** `apps/web/src/components/chat/ChatWidget.tsx`

```typescript
// Send message
const response = await fetch('/api/v1/chat/langgraph/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    session_id: sessionId,
    message: userMessage
  })
});

const data = await response.json();

// Handle response
if (data.conversationEnded) {
  showGoodbyeMessage(data.endReason);
  clearSession();
}

if (data.requiresUserInput) {
  enableInputField();
}

// Display bot response
displayMessage(data.response);
```

#### Frontend: Voice Chat

**File:** `apps/web/src/components/chat/VoiceChat.tsx`

```typescript
// Record audio
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  });

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    await sendVoiceMessage(audioBlob);
  };

  mediaRecorder.start();
};

// Send voice message
const sendVoiceMessage = async (audioBlob: Blob) => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('session_id', sessionId);
  formData.append('voice', 'nova');

  const response = await fetch('/api/v1/chat/orchestrator/voice', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: formData
  });

  // Get metadata
  const transcript = decodeURIComponent(response.headers.get('X-Transcript'));
  const responseText = decodeURIComponent(response.headers.get('X-Response-Text'));
  const conversationEnded = response.headers.get('X-Conversation-Ended') === 'true';

  // Display transcript
  displayUserMessage(transcript);
  displayBotMessage(responseText);

  // Play audio
  const audioBlob = await response.blob();
  const audio = new Audio(URL.createObjectURL(audioBlob));
  audio.play();

  // Handle end
  if (conversationEnded) {
    const endReason = response.headers.get('X-End-Reason');
    handleConversationEnd(endReason);
  }
};
```

---

## 4. Entity Relationships

### DDL Changes

**4 New Tables for AI Chat System:**

```
orchestrator_session (1) ─┬─< orchestrator_state (M)
                          ├─< orchestrator_agent_log (M)
                          └─< orchestrator_summary (M)

orchestrator_session.chat_session_id ─> f_customer_interaction.id (optional)
```

### Relationship Model

```
orchestrator_session
├─ chat_session_id → f_customer_interaction (optional link)
├─ user_id → d_person_employee
│
├─ orchestrator_state (key-value variables)
│  ├─ UNIQUE(session_id, key)
│  ├─ validated by Evaluator
│  └─ Used by LangGraph checkpointer
│
├─ orchestrator_agent_log (audit trail)
│  ├─ Indexed on (session_id, agent_role, created_ts DESC)
│  ├─ Links to MCP tool calls
│  └─ Tracks token usage and costs
│
└─ orchestrator_summary (context retention)
   ├─ Ordered by created_ts DESC
   └─ Generated every 10 messages
```

**Design Choice:** No foreign key to `f_customer_interaction` - intentionally flexible. Sessions can exist independently for API-only use, batch processing, or future integrations.

---

## 5. Central Configuration & Middleware

### Agent Model Configuration

**File:** `apps/api/src/modules/chat/orchestrator/config/agent-models.config.ts`

```typescript
export const AGENT_MODEL_CONFIG: Record<AgentRole, AgentModelConfig> = {
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1000,
    costPer1KTokens: 0.0015
  },
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1500,
    costPer1KTokens: 0.0015
  },
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  },
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 500,
    costPer1KTokens: 0.0015
  }
};

export function setAgentModel(agent: AgentRole, model: string, temp: number) {
  AGENT_MODEL_CONFIG[agent].model = model;
  AGENT_MODEL_CONFIG[agent].temperature = temp;
}

export function getAgentConfig(agent: AgentRole): AgentModelConfig {
  return AGENT_MODEL_CONFIG[agent];
}
```

**Override via environment:**
```bash
# .env
ORCHESTRATOR_MODEL=gpt-4-turbo-preview  # Use GPT-4 for complex reasoning
WORKER_MODEL=gpt-3.5-turbo              # Keep worker cheap
CRITIC_MODEL=gpt-3.5-turbo              # Simple boundary checks
```

### Engaging Messages Configuration

**File:** `apps/api/src/modules/chat/orchestrator/config/engaging-messages.config.ts`

**Pattern:** Activity-based message selection (zero LLM cost).

```typescript
export const ENGAGING_MESSAGES = {
  mcp_call: {
    customer_create: [
      { message: "Setting up your account...", icon: "✨", duration: 3000 }
    ],
    customer_search: [
      { message: "Let me check if you're in our system...", icon: "🔍" }
    ],
    employee_list: [
      { message: "Checking technician availability...", icon: "👨‍🔧" }
    ],
    task_create: [
      { message: "Creating your service request...", icon: "📋" }
    ]
  },

  // Sentiment-based empathetic responses
  sentiment: {
    urgent: [
      { prefix: "I understand this is urgent. ", tone: "prioritizing" }
    ],
    frustrating: [
      { prefix: "That sounds frustrating. You're in good hands. ", tone: "empathetic" }
    ],
    concerning: [
      { prefix: "That sounds concerning. Don't worry, we'll take care of it. ", tone: "reassuring" }
    ]
  },

  // Celebration messages
  success: [
    { message: "Perfect! ✨", tone: "celebratory" },
    { message: "All done! 🎯", tone: "accomplished" }
  ]
};

// Sentiment detection (keyword-based, no LLM)
export function detectSentiment(message: string): SentimentType | null {
  const lower = message.toLowerCase();

  if (/asap|urgent|emergency|right now/.test(lower)) return 'urgent';
  if (/frustrat|annoying|fed up/.test(lower)) return 'frustrating';
  if (/worried|concerned|not working|broken/.test(lower)) return 'concerning';
  if (/difficult|hard|complicated/.test(lower)) return 'difficult';

  return null;
}
```

### LangGraph Registry

**File:** `apps/api/src/modules/chat/orchestrator/langgraph/langgraph-orchestrator.service.ts`

```typescript
export class LangGraphOrchestratorService {
  private graphs: Map<string, CompiledStateGraph>;

  constructor(
    private mcpAdapter: MCPAdapterService,
    private stateManager: StateManagerService
  ) {
    this.initializeGraphs();
  }

  private initializeGraphs() {
    // Register intent graphs
    this.graphs.set(
      'CalendarBooking',
      createCalendarBookingGraph(this.mcpAdapter, this.stateManager)
    );

    // Add more intents here (zero orchestrator service changes)
    // this.graphs.set('ComplaintHandling', createComplaintGraph(...));
    // this.graphs.set('JobFollowUp', createJobFollowUpGraph(...));
  }

  async processMessage(input: OrchestratorInput): Promise<OrchestratorResponse> {
    const graph = this.graphs.get(input.intent);
    if (!graph) throw new Error(`Intent graph not found: ${input.intent}`);

    // Invoke graph with state
    const result = await graph.invoke(
      { messages: [input.message], ...input.state },
      { configurable: { thread_id: input.sessionId } }
    );

    return this.formatResponse(result);
  }
}
```

**Adding New Intent:**
1. Create `intent-graphs/my-intent.langgraph.ts`
2. Export `createMyIntentGraph()` function
3. Register in `initializeGraphs()`
4. No orchestrator service code changes needed

### Authentication Middleware

**Pattern:** JWT validation at orchestrator entry + RBAC at MCP layer.

```typescript
// Entry node in LangGraph
async function entryNode(
  state: OrchestratorState,
  mcpAdapter: MCPAdapter
): Promise<StateUpdate> {
  // 1. Decode JWT (no external validation for performance)
  const token = state.authToken;
  const payload = jwt.decode(token);

  // 2. Query user permissions
  const user = await db.query(`
    SELECT user_id, tenant_id, email, roles, permissions
    FROM d_person_employee
    WHERE user_id = $1
  `, [payload.sub]);

  // 3. Check intent-level permissions
  const graph = getIntentGraph(state.intent);
  if (!hasPermissions(user.permissions, graph.requiredPermissions)) {
    return {
      naturalResponse: "You don't have permission to use this feature.",
      conversationEnded: true,
      endReason: 'unauthorized'
    };
  }

  // 4. Store auth context in state
  return {
    variables: {
      is_authenticated: true,
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      user_name: user.name
    }
  };
}
```

**MCP Tool-Level RBAC:**
- All MCP calls include `authToken` parameter
- PMO API enforces permissions per endpoint
- Orchestrator doesn't need to check tool permissions (delegated to API)

---

## 6. User Interaction Flow Examples

### Example 1: Calendar Booking via Text Chat (Happy Path)

```
User: "I need landscaping service"
  ↓ POST /langgraph/message

LANGGRAPH:
  ✓ entry: Intent detected → CalendarBooking
  ✓ critic: Topic allowed (landscaping in boundaries)
  ✓ identify_customer: No session state → start workflow

[NODE: identify_customer]
  ✓ State check: No customer_name or customer_phone
  ✓ Response: "Can I get your name and phone number?"
  ↓ requiresUserInput = true

User: "I'm Sarah, 416-555-1234"
  ↓ POST /langgraph/message (session_id = abc-123)

[NODE: identify_customer] (resumed)
  ✓ LLM extract: customer_name="Sarah", customer_phone="4165551234"
  ✓ MCP call: customer_list({ phone: "4165551234" })
  ✓ Result: null (not found)
  ✓ Conditional edge: customer_id === null → toNode = "create_customer"

[NODE: create_customer]
  ✓ State check: Missing customer_address
  ✓ Response: "Thanks Sarah! What's your service address?"
  ↓ requiresUserInput = true

User: "123 Main St, Toronto"
  ↓ POST /langgraph/message (session_id = abc-123)

[NODE: create_customer] (resumed)
  ✓ LLM extract: customer_address="123 Main St", customer_city="Toronto"
  ✓ Engaging message: "Setting up your account..." ✨
  ✓ MCP call: customer_create({
      body_name: "Sarah",
      body_primary_phone: "4165551234",
      body_primary_address: "123 Main St",
      body_city: "Toronto"
    })
  ✓ Result: { id: "uuid-123", code: "CUST-001" }
  ✓ State update: customer_id="uuid-123", validated=true
  ✓ Conditional edge: default → toNode = "gather_booking_requirements"

[NODE: gather_booking_requirements]
  ✓ State check: Missing service_category, desired_date
  ✓ Response: "Perfect! When would you like us to come?"
  ↓ requiresUserInput = true

User: "Thursday at 2pm"
  ↓ POST /langgraph/message (session_id = abc-123)

[NODE: gather_booking_requirements] (resumed)
  ✓ LLM extract: desired_date="2025-11-14", desired_time="14:00"
  ✓ MCP call: employee_list({ department: "Landscaping" })
  ✓ Result: [{ id: "emp-1", name: "John" }, ...]
  ✓ State update: available_employees=[...], selected_time="14:00"
  ✓ Conditional edge: employees.length > 0 → toNode = "create_booking"

[NODE: create_booking]
  ✓ Engaging message: "Creating your service request..." 📋
  ✓ MCP call: task_create({
      body_name: "Landscaping service",
      body_descr: "Landscaping at 123 Main St",
      body_metadata: JSON.stringify({
        customer_id: "uuid-123",
        scheduled_date: "2025-11-14T14:00:00"
      })
    })
  ✓ Result: { id: "task-456", code: "TASK-20251106-0042" }
  ✓ MCP call: linkage_create({
      body_entity_1_id: "uuid-123",
      body_entity_2_id: "task-456",
      body_relationship_type: "customer_task"
    })
  ✓ State update: task_id="task-456", task_code="TASK-20251106-0042"
  ✓ Conditional edge: default → toNode = "confirm_and_summarize"

[NODE: confirm_and_summarize]
  ✓ Summary generation:
    "You're all set, Sarah! ✨
     📅 Booking Confirmed
     Service: Landscaping
     Date: 2025-11-14 at 2:00 PM
     Location: 123 Main St, Toronto
     Booking #: TASK-20251106-0042"
  ✓ Session completion:
    - Update orchestrator_session: status='completed', completed_ts=now()
    - Generate conversation summary
    - Save to orchestrator_summary
  ✓ No next node → END

Response: {
  sessionId: "abc-123",
  response: "You're all set, Sarah! ...",
  completed: true,
  conversationEnded: false,
  engagingMessage: "All done! 🎯"
}
```

**Total conversation:**
- Turns: 4
- MCP calls: 4 (customer_list, customer_create, employee_list, task_create, linkage_create)
- Tokens: ~2500
- Cost: ~$0.0038 (less than half a cent)

### Example 2: Off-Topic Handling

```
User: "What's the weather tomorrow?"

LANGGRAPH:
  ✓ entry: No intent detected → default to CalendarBooking
  ✓ critic: Off-topic check

[NODE: critic]
  ✓ LLM-based topic detection:
    - User message: "What's the weather tomorrow?"
    - Allowed topics: [booking, scheduling, landscaping, HVAC, plumbing]
    - Forbidden topics: [weather, news, general knowledge]
  ✓ Result: Off-topic (weather)
  ✓ State update: _off_topic_count = 1
  ✓ Conditional edge: _off_topic_count === 1 → warning
  ✓ Response: "I'm specifically here for service bookings. Can I help you schedule an appointment? (This is your first warning.)"

User: "Tell me a joke"

[NODE: critic] (resumed)
  ✓ LLM-based topic detection:
    - User message: "Tell me a joke"
    - Off-topic again
  ✓ State update: _off_topic_count = 2
  ✓ Conditional edge: _off_topic_count >= 2 → end_conversation
  ✓ Response: "I'm specifically designed to help with our home services. For other questions, please visit our website."
  ✓ Session completion:
    - Update orchestrator_session: status='failed', completed_ts=now()
    - endReason='off_topic'

Response: {
  sessionId: "abc-123",
  response: "I'm specifically designed to help with our home services...",
  conversationEnded: true,
  endReason: "off_topic"
}
```

### Example 3: Voice Booking Flow

```
User: [Speaks into mic] "I need service"
  ↓ MediaRecorder → audioBlob (webm)
  ↓ POST /orchestrator/voice
  ↓ multipart/form-data: { file: audioBlob, voice: "nova" }

BACKEND:
  STEP 1: WHISPER STT
    ✓ OpenAI Whisper API
    ✓ Input: Audio buffer (webm)
    ✓ Output: "I need service"
    ✓ Duration: 1.2s
    ✓ Cost: $0.0003

  STEP 2: LANGGRAPH ORCHESTRATOR
    ✓ entry: Intent detected → CalendarBooking
    ✓ identify_customer: "Can I get your name and phone number?"
    ✓ Duration: 1.8s
    ✓ Cost: $0.0015

  STEP 3: OPENAI TTS
    ✓ OpenAI TTS API (tts-1, nova voice)
    ✓ Input: "Can I get your name and phone number?"
    ✓ Output: MP3 audio buffer
    ✓ Duration: 1.1s
    ✓ Cost: $0.0005

Response:
  Headers:
    X-Session-Id: abc-123
    X-Transcript: I%20need%20service
    X-Response-Text: Can%20I%20get%20your%20name%20and%20phone%20number
    X-Intent: CalendarBooking
    X-Current-Node: identify_customer
    X-Completed: false
    X-Conversation-Ended: false
  Body: MP3 audio stream

FRONTEND:
  ✓ Parse headers (transcript, response text)
  ✓ Display transcript: "You said: I need service"
  ✓ Display response: "Bot said: Can I get your name and phone number?"
  ✓ Play audio: new Audio(URL.createObjectURL(audioBlob)).play()

User: [Speaks] "I'm Sarah, 416-555-1234"
  ↓ POST /orchestrator/voice (session_id = abc-123)

[... continues same as text chat example above ...]

User: [Speaks] "Yes, that works!"

BACKEND:
  STEP 1: STT → "Yes, that works!"
  STEP 2: ORCHESTRATOR → Create booking
  STEP 3: TTS → "You're all set, Sarah! Booking confirmed..."

Response:
  Headers:
    X-Completed: true
  Body: MP3 audio

FRONTEND:
  ✓ Play confirmation audio
  ✓ Display booking summary
  ✓ Session complete
```

**Total voice conversation:**
- Turns: 4
- Total latency: ~15-20 seconds (cumulative across all turns)
- Total cost: ~$0.016 (Whisper + GPT-3.5 + TTS combined)

---

## 7. Critical Considerations When Building

### For Developers Extending This System

#### Adding New Intent Graphs

```typescript
// 1. Create graph file
// apps/api/src/modules/chat/orchestrator/langgraph/complaint-handling.langgraph.ts

import { StateGraph, START, END } from '@langchain/langgraph';
import { OrchestratorStateAnnotation } from '../types/langgraph-state.types.js';

export function createComplaintHandlingGraph(
  mcpAdapter: MCPAdapterService,
  stateManager: StateManagerService
) {
  const graph = new StateGraph(OrchestratorStateAnnotation)
    .addNode('entry', entryNode)
    .addNode('collect_complaint', collectComplaintNode)
    .addNode('escalate', escalateNode)
    .addEdge(START, 'entry')
    .addConditionalEdges('collect_complaint', routeComplaint);

  return graph.compile({
    checkpointer: new PostgresCheckpointer(stateManager)
  });
}

async function collectComplaintNode(
  state: OrchestratorState,
  mcpAdapter: MCPAdapterService
): Promise<StateUpdate> {
  // Collect complaint details
  if (!state.variables.complaint_description) {
    return {
      naturalResponse: "Please describe the issue you're experiencing.",
      requiresUserInput: true
    };
  }

  // Create support ticket via MCP
  const result = await mcpAdapter.executeMCPTool('task_create', {
    body_name: 'Customer Complaint',
    body_descr: state.variables.complaint_description,
    body_metadata: JSON.stringify({
      complaint_type: state.variables.complaint_type,
      urgency: 'high'
    })
  }, state.authToken);

  return {
    variables: { ticket_id: result.id },
    naturalResponse: `I've created ticket ${result.code} for your complaint.`
  };
}

// 2. Register in service
// apps/api/src/modules/chat/orchestrator/langgraph/langgraph-orchestrator.service.ts

private initializeGraphs() {
  this.graphs.set('CalendarBooking', createCalendarBookingGraph(...));
  this.graphs.set('ComplaintHandling', createComplaintHandlingGraph(...)); // ← Add here
}

// 3. Update intent detection
// apps/api/src/modules/chat/orchestrator/services/openai.service.ts

async detectIntent(message: string): Promise<string> {
  const response = await this.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `Classify user intent:
          - CalendarBooking: scheduling services
          - ComplaintHandling: reporting issues, complaints  ← Add here
          Respond with only the intent name.`
      },
      { role: 'user', content: message }
    ]
  });

  return response.choices[0].message.content;
}
```

#### State Management Best Practices

```typescript
// ✅ DO: Store all critical data in state
async function myNode(state: OrchestratorState): Promise<StateUpdate> {
  const result = await mcpAdapter.executeMCPTool(...);

  return {
    variables: {
      customer_id: result.id,        // Store in state
      customer_code: result.code,
      customer_email: result.email
    },
    naturalResponse: "Customer created!"
  };
}

// ✅ DO: Check state before executing
async function createBookingNode(state: OrchestratorState): Promise<StateUpdate> {
  // Validate required fields
  const missing = ['customer_id', 'service_category', 'desired_date']
    .filter(key => !state.variables[key]);

  if (missing.length > 0) {
    return {
      naturalResponse: `I still need: ${missing.join(', ')}`,
      requiresUserInput: true
    };
  }

  // Proceed with booking creation
  const result = await mcpAdapter.executeMCPTool('task_create', ...);
  return { variables: { task_id: result.id } };
}

// ❌ DON'T: Store in memory only
let tempCustomerId: string; // Lost on crash!

// ✅ DO: Use LangGraph checkpointing (automatic)
// State is saved after every node execution automatically
```

#### MCP Tool Calls

```typescript
// ✅ DO: Use dynamic body fields
await mcpAdapter.executeMCPTool('customer_update', {
  customer_id: state.variables.customer_id,
  body_primary_address: '123 Main St',  // Extracted to body.primary_address
  body_city: 'Toronto',                 // Extracted to body.city
  body_postal_code: 'M5H 2N2'          // Extracted to body.postal_code
}, state.authToken);

// ✅ DO: Handle MCP errors gracefully
try {
  const result = await mcpAdapter.executeMCPTool('customer_create', args, token);
  return { variables: { customer_id: result.id } };
} catch (error) {
  return {
    naturalResponse: "I had trouble creating that record. Let me try another approach.",
    requiresUserInput: false
  };
}

// ❌ DON'T: Call MCP tools without auth token
await mcpAdapter.executeMCPTool('customer_create', args, null); // FAILS!

// ✅ DO: Use JWT from state
await mcpAdapter.executeMCPTool('customer_create', args, state.authToken);
```

#### Conditional Edges

```typescript
// ✅ DO: Use clear routing logic
function routeAfterIdentify(state: OrchestratorState): string {
  // Check state and return next node name
  if (state.variables.customer_id) {
    return 'welcome_existing';
  }

  if (state.variables.is_new_customer) {
    return 'create_customer';
  }

  // Default fallback
  return 'identify_customer'; // Stay on same node
}

// ✅ DO: Add logging for debugging
function routeAfterIdentify(state: OrchestratorState): string {
  console.log('[Route] Current node:', state.currentNode);
  console.log('[Route] State:', state.variables);

  if (state.variables.customer_id) {
    console.log('[Route] → welcome_existing');
    return 'welcome_existing';
  }

  console.log('[Route] → create_customer');
  return 'create_customer';
}

// ❌ DON'T: Use complex logic in routing
function routeComplex(state: OrchestratorState): string {
  // Bad: Too much logic, hard to debug
  return state.variables.customer_id && state.variables.verified && !state.variables.blocked
    ? 'proceed'
    : state.variables.is_new && !state.variables.address_valid
    ? 'collect_address'
    : 'error';
}

// ✅ DO: Break down into multiple edges
graph
  .addConditionalEdges('verify_customer', routeVerified)
  .addConditionalEdges('check_address', routeAddress);
```

#### Performance Optimization

```typescript
// ✅ DO: Use appropriate models per complexity
// Simple tasks: gpt-3.5-turbo (cheap, fast)
// Complex tasks: gpt-4-turbo (expensive, accurate)

// ✅ DO: Limit state lookups
const allState = await stateManager.getAllState(sessionId);  // Once per turn
const customerId = allState.customer_id;
const taskId = allState.task_id;
// NOT: await getState('customer_id'), await getState('task_id'), ...

// ✅ DO: Generate summaries periodically
if (messageCount % 10 === 0) {
  const summary = await openaiService.generateSummary(sessionId);
  await stateManager.saveSummary({
    session_id: sessionId,
    summary_text: summary,
    message_count: messageCount
  });
}

// ✅ DO: Add database indexes
CREATE INDEX idx_orchestrator_log_session
  ON orchestrator_agent_log(session_id, created_ts DESC);

// ✅ DO: Limit log retention
DELETE FROM orchestrator_agent_log
WHERE created_ts < NOW() - INTERVAL '30 days';
```

#### Error Handling

```typescript
// ✅ DO: Return user-friendly errors
async function myNode(state: OrchestratorState): Promise<StateUpdate> {
  try {
    const result = await mcpAdapter.executeMCPTool(...);
    return { variables: { result_id: result.id } };
  } catch (error) {
    console.error('[Node Error]', error);

    // Return friendly message to user
    return {
      naturalResponse: "I had trouble with that request. Let me try a different approach.",
      requiresUserInput: false
    };
  }
}

// ❌ DON'T: Expose internal errors to users
return {
  naturalResponse: `Error: pg_query failed with code 23505`  // BAD!
};

// ✅ DO: Log errors to orchestrator_agent_log
await stateManager.logAgentAction({
  session_id,
  agent_role: 'worker',
  agent_action: 'execute_mcp_call',
  success: false,
  error_message: error.message,
  mcp_tool_name: 'customer_create',
  mcp_tool_args: args
});
```

#### Security

```typescript
// ✅ DO: Validate JWT at entry
async function entryNode(state: OrchestratorState): Promise<StateUpdate> {
  if (!state.authToken) {
    return {
      naturalResponse: "You must be logged in to use this feature.",
      conversationEnded: true,
      endReason: 'unauthorized'
    };
  }

  const payload = jwt.decode(state.authToken);
  if (!payload) {
    return {
      naturalResponse: "Invalid authentication token.",
      conversationEnded: true,
      endReason: 'unauthorized'
    };
  }

  return {
    variables: {
      user_id: payload.sub,
      user_email: payload.email
    }
  };
}

// ✅ DO: Use RBAC at MCP layer
// All MCP calls include authToken → API enforces RBAC automatically

// ❌ DON'T: Trust client-provided user_id
// Body: { user_id: "malicious-user-id" } ← IGNORE THIS
// Extract from validated JWT only

// ✅ DO: Sanitize PII in logs
await logAgentAction({
  mcp_tool_args: {
    ...args,
    phone: 'REDACTED',      // Don't log full phone
    email: 'REDACTED'       // Don't log email
  }
});
```

#### Testing

```typescript
// ✅ DO: Test graphs independently
describe('CalendarBooking Graph', () => {
  it('should handle new customer flow', async () => {
    const graph = createCalendarBookingGraph(mockMCP, mockState);

    const result = await graph.invoke({
      messages: ["I'm Sarah, 416-555-1234"],
      variables: { customer_name: 'Sarah', customer_phone: '4165551234' },
      authToken: 'mock-token'
    });

    expect(result.variables.customer_id).toBeDefined();
  });
});

// ✅ DO: Mock MCP calls
const mockMCP = {
  executeMCPTool: jest.fn()
    .mockResolvedValueOnce({ id: 'mock-customer-id' })
    .mockResolvedValueOnce({ id: 'mock-task-id' })
};

// ✅ DO: Test conversation endings
it('should end conversation after 2 off-topic messages', async () => {
  const graph = createCalendarBookingGraph(mockMCP, mockState);

  // First off-topic
  let result = await graph.invoke({
    messages: ["What's the weather?"],
    variables: { _off_topic_count: 1 }
  });
  expect(result.conversationEnded).toBe(false);

  // Second off-topic
  result = await graph.invoke({
    messages: ["Tell me a joke"],
    variables: { _off_topic_count: 2 }
  });
  expect(result.conversationEnded).toBe(true);
  expect(result.endReason).toBe('off_topic');
});

// ✅ DO: Test MCP integration
it('should call correct MCP tool', async () => {
  const mockMCP = { executeMCPTool: jest.fn().mockResolvedValue({ id: 'test' }) };

  await createCustomerNode(mockState, mockMCP);

  expect(mockMCP.executeMCPTool).toHaveBeenCalledWith(
    'customer_create',
    expect.objectContaining({
      body_name: 'Sarah',
      body_primary_phone: '4165551234'
    }),
    'mock-token'
  );
});
```

---

## Quick Reference

### File Locations

```
apps/api/src/modules/chat/
├── orchestrator/
│   ├── langgraph/
│   │   ├── langgraph-orchestrator.service.ts    ← Main orchestrator
│   │   ├── calendar-booking.langgraph.ts        ← Intent graph
│   │   └── postgres-checkpointer.ts             ← State persistence
│   ├── services/
│   │   └── openai.service.ts                    ← LLM wrapper
│   ├── config/
│   │   ├── agent-models.config.ts               ← Model configuration
│   │   └── engaging-messages.config.ts          ← Activity messages
│   ├── types/
│   │   ├── langgraph-state.types.ts             ← State annotation
│   │   └── intent-graph.types.ts                ← Legacy types
│   ├── state/
│   │   └── state-manager.service.ts             ← Database operations
│   ├── voice-orchestrator.service.ts            ← Voice (STT + TTS)
│   └── voice-orchestrator.routes.ts             ← Voice endpoints
├── mcp-adapter.service.ts                       ← MCP tool calling
└── routes.ts                                    ← API routes

db/
├── 60_orchestrator_session.ddl                  ← Session table
├── 61_orchestrator_state.ddl                    ← State table
├── (orchestrator_agent_log in session.ddl)      ← Agent log
└── (orchestrator_summary in session.ddl)        ← Summaries

apps/web/src/components/chat/
├── ChatWidget.tsx                               ← Text chat UI
└── VoiceChat.tsx                                ← Voice chat UI
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional - Model Overrides (all default to gpt-3.5-turbo)
ORCHESTRATOR_MODEL=gpt-3.5-turbo
WORKER_MODEL=gpt-3.5-turbo
EVALUATOR_MODEL=gpt-3.5-turbo
CRITIC_MODEL=gpt-3.5-turbo
```

### Cost Metrics

| Component | Model | Cost per 1K tokens / unit | Typical Usage per Conversation |
|-----------|-------|---------------------------|-------------------------------|
| **Whisper STT** | whisper-1 | $0.006/minute | 25 seconds = $0.0025 |
| **Orchestrator** | gpt-3.5-turbo | $0.0015/1K tokens | 1,000 tokens = $0.0015 |
| **Worker** | gpt-3.5-turbo | $0.0015/1K tokens | 2,000 tokens = $0.0030 |
| **Evaluator** | gpt-3.5-turbo | $0.0015/1K tokens | 500 tokens = $0.0008 |
| **Critic** | gpt-3.5-turbo | $0.0015/1K tokens | 500 tokens = $0.0008 |
| **OpenAI TTS** | tts-1 | $0.015/1M chars | 500 chars = $0.0075 |
| **Total** | | | **~$0.016** |

**Comparison:**
- Current (GPT-3.5 Turbo): **$0.016/conversation**
- OpenAI Realtime API: $0.300/conversation (18.75x more expensive)
- GPT-4 Turbo agents: $0.320/conversation (20x more expensive)

### Performance Benchmarks

| Metric | Typical Value |
|--------|---------------|
| **Text Chat Latency** | 500-2000ms |
| **Voice Chat Latency** | 1.7-5.5 seconds |
| **State Lookups** | 5-10 queries/message |
| **Token Usage** | 500-1500 tokens/message (with summaries) |
| **Database Writes** | 1 checkpoint per node |

### API Quick Test

```bash
# Text chat
TOKEN="your-jwt-token"
curl -X POST http://localhost:4000/api/v1/chat/langgraph/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "I need landscaping service"}'

# Voice chat
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@audio.webm" \
  -F "voice=nova" \
  --output response.mp3
```

---

## Status

**Version:** 2.0.0
**Framework:** LangGraph (production)
**Status:** ✅ Production Ready
**Last Updated:** 2025-11-06

**Key Features:**
- ✅ Text chat via LangGraph orchestrator
- ✅ Voice chat via Whisper STT + GPT-3.5 + OpenAI TTS
- ✅ Multi-agent coordination (Orchestrator, Worker, Evaluator, Critic)
- ✅ MCP tool integration (60+ PMO functions)
- ✅ PostgreSQL state persistence
- ✅ Cost-optimized GPT-3.5 Turbo (~$0.016/conversation)
- ✅ Conversation boundaries (off-topic detection, auto-goodbye)
- ✅ Engaging messages and empathetic responses
- ✅ Complete audit trail and cost tracking

**Next Steps:**
- [ ] Add more intent graphs (ComplaintHandling, JobFollowUp)
- [ ] Implement streaming TTS for voice
- [ ] LangSmith integration for debugging
- [ ] Multi-language support
- [ ] Voice emotion detection

---

**For questions or issues, contact the development team.**
