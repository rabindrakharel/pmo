# Multi-Agent LLM Orchestrator - Technical Architecture

**Version:** 2.0.0 | **Status:** Production | **Updated:** 2025-11-06

> **🚀 FRAMEWORK MIGRATION:** The orchestrator has been migrated to **LangGraph** (v2.0). See [`LANGGRAPH_MIGRATION.md`](./LANGGRAPH_MIGRATION.md) for migration guide.
>
> **New API:** `/api/v1/chat/langgraph/` (LangGraph-based)
> **Legacy API:** `/api/v1/chat/orchestrator/` (deprecated, will be removed in v3.0)

> **Audience:** Staff architects and engineers implementing or extending the orchestrator

---

## 1. Semantics & Business Context

### Purpose
Stateful multi-agent orchestration framework enabling small LLM models to execute complex, reliable workflows through structured agent coordination and external state management.

### Business Problem Solved
**Traditional LLM Limitations:**
- Context loss over long conversations
- Topic drift and hallucinations
- Incomplete task execution
- No quality control mechanisms
- High cost with large models

**Orchestrator Solution:**
- External state in PostgreSQL prevents memory loss
- Specialized agents (Critic, Evaluator) enforce boundaries and validate outputs
- Declarative intent graphs ensure workflow completion
- Agent-specific model configuration optimizes costs (30-40% reduction)
- Complete audit trail for compliance

### Core Value Proposition
Run GPT-3.5-turbo (cheap) with reliability comparable to GPT-4 (expensive) through orchestration, not model size.

---

## 2. Architecture & DRY Design Patterns

### System Block Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (React 19 / Web / Mobile)                           │
│  ┌──────────────┐  ┌─────────────────────────────────────┐ │
│  │ Text Chat    │  │ Voice Chat                          │ │
│  │ HTTP POST    │  │ MediaRecorder → Multipart Upload    │ │
│  └──────┬───────┘  └────────┬────────────────────────────┘ │
└─────────┼───────────────────┼──────────────────────────────┘
          │                   │
          │ /orchestrator/message (JSON)
          │ /orchestrator/voice (multipart/form-data)
          │ Bearer: JWT
          ▼
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR FRAMEWORK (Fastify API)                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. AUTHENTICATOR AGENT                              │   │
│  │    - JWT validation                                 │   │
│  │    - Permission checking (requiredPermissions[])    │   │
│  │    - Model: N/A (no LLM, just token decode)        │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. ORCHESTRATOR SERVICE                             │   │
│  │    - Intent detection (keyword or LLM-based)        │   │
│  │    - Intent graph loading & node traversal          │   │
│  │    - Agent coordination (Worker→Critic→Evaluator)   │   │
│  │    - Model: gpt-3.5-turbo (configurable)           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. CRITIC AGENT (Before & After Worker)            │   │
│  │    - reviewConversation: Off-topic detection       │   │
│  │    - reviewWorkerOutput: Quality check             │   │
│  │    - checkBoundaryRules: Custom rule enforcement   │   │
│  │    - Model: gpt-3.5-turbo (small/fast)             │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 4. WORKER AGENT                                     │   │
│  │    - executeMCPCall: Tool invocation via MCP       │   │
│  │    - collectData: Extract from user message        │   │
│  │    - presentOptions: Show choices                  │   │
│  │    - Engaging messages ("Checking availability...")│   │
│  │    - Model: gpt-3.5-turbo (configurable)           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 5. EVALUATOR AGENT                                  │   │
│  │    - evaluateNode: Validate required fields        │   │
│  │    - Check data formats (regex)                    │   │
│  │    - Business rules (date >= today)                │   │
│  │    - Determine next node via transition conditions │   │
│  │    - Model: gpt-3.5-turbo (small/fast)             │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ STATE MANAGER                                       │   │
│  │    - PostgreSQL via Drizzle ORM                    │   │
│  │    - Session state, variables, logs, summaries     │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │  MCP SERVER                 │
            │  - 60+ PMO API tools        │
            │  - Authenticated with JWT   │
            └─────────────────────────────┘
```

### DRY Pattern: Intent Graphs

**Problem:** Hard-coding workflows in code requires redeployment for changes.

**Solution:** Declarative intent graphs stored as data structures.

```typescript
export interface IntentGraph {
  name: string;              // "CalendarBooking"
  startNode: string;         // "identify_customer"
  nodes: Record<string, GraphNode>;
  boundaries: {
    allowedTopics: string[];
    forbiddenTopics: string[];
    maxTurns: number;
  };
}

// New intent = New graph file, zero code changes
```

### DRY Pattern: Stateful State Management

**Problem:** LLM context window limited, expensive to resend full history.

**Solution:** External state in PostgreSQL, summaries regenerated periodically.

```typescript
// State persisted externally
orchestrator_session (current_intent, current_node, status)
orchestrator_state (key-value pairs: customer_id, desired_date, etc.)
orchestrator_agent_log (full audit trail)
orchestrator_summary (LLM-generated summaries every 10 messages)
```

### DRY Pattern: Agent-Specific Models

**Problem:** All agents using GPT-4 wastes money on simple tasks.

**Solution:** Configure models per agent role.

```typescript
AGENT_MODEL_CONFIG = {
  orchestrator: 'gpt-3.5-turbo',   // Needs reasoning
  worker: 'gpt-3.5-turbo',         // Needs tool use + NL
  evaluator: 'gpt-3.5-turbo',      // Logic-heavy
  critic: 'gpt-3.5-turbo'          // Fast checks
}
// Override via env: WORKER_MODEL=gpt-4-turbo-preview
```

---

## 3. Request Flow: Frontend → Backend

### Text Chat Flow

```
1. USER TYPES MESSAGE
   → React component: <ChatWidget>

2. FRONTEND SENDS
   POST /api/v1/chat/orchestrator/message
   Headers: { Authorization: "Bearer JWT" }
   Body: { session_id?, message: "I need service" }

3. AUTHENTICATOR VALIDATES
   - Extract JWT from header
   - Decode payload (user_id, roles, permissions)
   - Check requiredPermissions vs user permissions
   - Return auth_context or error

4. ORCHESTRATOR DETECTS INTENT
   - No session_id? → detectIntent(message) → "CalendarBooking"
   - Load IntentGraph from registry
   - Check graph.requiredPermissions
   - Set current_intent, current_node = startNode

5. CRITIC REVIEWS CONVERSATION
   - reviewConversation(userMessage, graph.boundaries)
   - Check allowedTopics/forbiddenTopics (keyword match)
   - Track _off_topic_count, _turn_count
   - Off-topic × 2 or turns > maxTurns → shouldEndConversation = true

6. EXECUTE WORKFLOW (Loop through nodes)
   For each node:

   a. WORKER EXECUTES ACTIONS
      - Action types: mcp_call, collect_data, present_options
      - MCP call: Map state → args → executeMCPTool(name, args, JWT)
      - Collect data: Extract fields from userMessage (regex/NER)
      - Engaging message: "Checking technician availability..." 👨‍🔧

   b. CRITIC REVIEWS OUTPUT
      - reviewWorkerOutput: Detect hallucinations, inconsistencies
      - Hallucination = success:true but no stateUpdates

   c. EVALUATOR VALIDATES
      - evaluateNode: Check requiredState[] present
      - Validate data formats (regex)
      - Business rules (date >= today)
      - Determine nextNode via transition.condition evaluation

   d. STATE MANAGER PERSISTS
      - setState(key, value, {source, validated})
      - updateSession(current_node, session_context)
      - logAgentAction(agent_role, action, success, duration_ms)

   e. CHECK EXIT CONDITIONS
      - requiresUserInput? → Return, wait for next message
      - No nextNode? → Workflow complete
      - Node.requiresUserConfirmation? → Return, wait

7. RESPONSE SENT
   {
     sessionId, response, intent, currentNode,
     requiresUserInput, completed, conversationEnded, endReason
   }
```

### Voice Chat Flow

```
1. USER RECORDS AUDIO
   → MediaRecorder → Blob (webm/wav/mp3)

2. FRONTEND SENDS
   POST /api/v1/chat/orchestrator/voice
   Content-Type: multipart/form-data
   Fields: { file: audioBlob, session_id?, voice: "nova" }

3. BACKEND: SPEECH-TO-TEXT
   - OpenAI Whisper API (whisper-1 model)
   - Input: Audio buffer
   - Output: Transcript string
   - Cost: $0.006 per minute

4. ORCHESTRATOR PROCESSES (Same as text flow above)
   - processMessage(transcript) → response text

5. BACKEND: TEXT-TO-SPEECH
   - OpenAI TTS API (tts-1 model)
   - Input: response text
   - Voice: alloy/echo/fable/onyx/nova/shimmer
   - Output: MP3 audio buffer
   - Cost: $0.015 per 1M chars

6. RESPONSE SENT
   Headers: {
     X-Session-Id, X-Transcript, X-Response-Text,
     X-Intent, X-Completed, X-Conversation-Ended
   }
   Body: Audio/MP3 stream
```

---

## 4. Database, API & UI/UX Mapping

### Database Tables

#### `orchestrator_session`
**Purpose:** Tracks orchestration session lifecycle and state.

```sql
id uuid PRIMARY KEY
session_number varchar(50) UNIQUE  -- ORCH-20251106-0001
chat_session_id uuid              -- Link to f_customer_interaction
user_id uuid
current_intent varchar(100)       -- "CalendarBooking"
current_node varchar(100)         -- "gather_booking_requirements"
status varchar(50)                -- active/paused/completed/failed
session_context jsonb             -- {customer_id, task_id, ...}
conversation_summary text         -- LLM-generated summary
total_agent_calls integer
total_mcp_calls integer
```

**Indexes:** chat_session_id, user_id, status, current_intent

#### `orchestrator_state`
**Purpose:** Key-value store for session variables.

```sql
id uuid PRIMARY KEY
session_id uuid REFERENCES orchestrator_session
key varchar(100)                  -- "customer_name", "desired_date"
value jsonb                       -- Any type
source varchar(100)               -- "worker", "evaluator"
node_context varchar(100)         -- Which node produced this
validated boolean                 -- Evaluator marked as valid
UNIQUE(session_id, key)
```

#### `orchestrator_agent_log`
**Purpose:** Complete audit trail of agent actions.

```sql
id uuid PRIMARY KEY
session_id uuid
agent_role varchar(50)           -- worker/evaluator/critic
agent_action varchar(100)        -- mcp_call/validate_node
node_context varchar(100)
mcp_tool_name varchar(100)       -- If MCP call
mcp_tool_args jsonb
mcp_tool_result jsonb
success boolean
error_message text
natural_response text            -- User-facing message
duration_ms integer
created_ts timestamptz
```

**Use:** Debugging, compliance, performance analysis.

#### `orchestrator_summary`
**Purpose:** LLM-generated conversation summaries (context retention).

```sql
id uuid PRIMARY KEY
session_id uuid
summary_type varchar(50)        -- full/incremental/node_completion
summary_text text
up_to_node varchar(100)
message_count integer
```

**Pattern:** Generate summary every 10 messages, pass to LLM instead of full history.

### API Endpoints

#### Text Chat
```
POST /api/v1/chat/orchestrator/message
  Body: { session_id?, message, chat_session_id?, user_id? }
  Response: { sessionId, response, intent, currentNode,
              requiresUserInput, completed, conversationEnded, endReason }

GET /api/v1/chat/orchestrator/session/:id/status
  Response: { session, state, logs }

GET /api/v1/chat/orchestrator/intents
  Response: { count, intents[] }

GET /api/v1/chat/orchestrator/intent/:name/graph
  Response: { graph: { nodes[], boundaries } }
```

#### Voice Chat
```
POST /api/v1/chat/orchestrator/voice
  Content-Type: multipart/form-data
  Fields: { file: audioBlob, session_id?, voice? }
  Response: Audio/MP3 + metadata headers

POST /api/v1/chat/orchestrator/stt
  Response: { transcript }

POST /api/v1/chat/orchestrator/tts
  Body: { text, voice? }
  Response: Audio/MP3

GET /api/v1/chat/orchestrator/voices
  Response: { voices[] }
```

### UI/UX Mapping

**Frontend:** `apps/web/src/components/chat/ChatWidget.tsx`

**Integration:**
```typescript
// OLD (direct OpenAI)
await fetch('/api/v1/chat/message', ...)

// NEW (orchestrator)
await fetch('/api/v1/chat/orchestrator/message', ...)

// Voice (new)
const formData = new FormData();
formData.append('file', audioBlob);
await fetch('/api/v1/chat/orchestrator/voice', ...)
```

**Response Handling:**
```typescript
if (response.conversationEnded) {
  showGoodbyeMessage(response.endReason);
  clearSession();
}
if (response.requiresUserInput) {
  enableInputField();
}
```

---

## 5. Entity Relationships

### DDL Changes

**4 New Tables Added:**

```
orchestrator_session (1) ─┬─< orchestrator_state (M)
                          ├─< orchestrator_agent_log (M)
                          └─< orchestrator_summary (M)

orchestrator_session.chat_session_id ─> f_customer_interaction.id
```

**Relationship Model:**
```
orchestrator_session
├─ chat_session_id → f_customer_interaction (optional link)
│
├─ orchestrator_state (key-value pairs)
│  └─ UNIQUE(session_id, key)
│
├─ orchestrator_agent_log (audit trail)
│  └─ Indexed on (session_id, agent_role, created_ts DESC)
│
└─ orchestrator_summary (context summaries)
   └─ Ordered by created_ts DESC
```

**No Foreign Keys:** Intentionally flexible. Sessions can exist independently of chat interactions for batch processing or API-only use.

---

## 6. Central Configuration & Middleware

### Agent Model Configuration

**File:** `orchestrator/config/agent-models.config.ts`

```typescript
export const AGENT_MODEL_CONFIG: Record<string, AgentModelConfig> = {
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1000
  },
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1500
  },
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500
  },
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 500
  }
};
```

**Runtime Override:**
```typescript
setAgentModel('worker', 'gpt-4-turbo-preview', 0.7);
```

### Engaging Messages Configuration

**File:** `orchestrator/config/engaging-messages.config.ts`

**Pattern:** Activity-based message selection (zero LLM cost).

```typescript
ENGAGING_MESSAGES.mcp_call = {
  customer_create: [
    { message: "Setting up your account...", icon: "✨", duration: 3000 }
  ],
  employee_list: [
    { message: "Checking technician availability...", icon: "👨‍🔧" }
  ]
};

// Sentiment detection (keyword-based)
detectSentiment(message) → 'urgent' | 'frustrating' | 'concerning' | null

// Empathetic responses
if (sentiment === 'urgent') {
  prefix = "I understand this is urgent. Let me prioritize this for you. ";
}
```

### Intent Graph Registry

**File:** `orchestrator/intent-graphs/index.ts`

```typescript
export const IntentGraphRegistry: Record<string, IntentGraph> = {
  CalendarBooking: CalendarBookingGraph,
  // Add more intents here (no code changes required)
};
```

**Adding New Intent:**
1. Create `intent-graphs/my-intent.graph.ts`
2. Export graph object
3. Register in `IntentGraphRegistry`
4. Update `detectIntent()` in `orchestrator.service.ts`

### Authentication Middleware

**Handled by:** `authenticatorAgent.authenticate()`

**Flow:**
```typescript
1. Extract token from Authorization header
2. Decode JWT payload (no external validation for performance)
3. Query d_person_employee for user_id
4. Return { user_id, tenant_id, email, roles[], permissions[] }
5. Check requiredPermissions[] vs user permissions[]
```

**Permission Model:** RBAC-enforced at MCP layer. Orchestrator only checks graph-level permissions (e.g., `['customer:write', 'booking:write']`).

---

## 7. User Interaction Flow Examples

### Example 1: Calendar Booking (Happy Path)

```
USER: "I need landscaping service"
  ↓ POST /orchestrator/message

AUTHENTICATOR:
  ✓ JWT valid, user authenticated

ORCHESTRATOR:
  ✓ Intent detected: CalendarBooking
  ✓ Load graph, set startNode = "identify_customer"

CRITIC:
  ✓ Topic allowed (landscaping in allowedTopics)

[NODE: identify_customer]
WORKER:
  Action: collect_data [customer_name, customer_phone]
  → Response: "Can I get your name and phone number?"
  ↓ requiresUserInput = true

USER: "I'm Sarah, 416-555-1234"
  ↓ POST /orchestrator/message (session_id = abc-123)

WORKER:
  Extract: customer_name = "Sarah", customer_phone = "4165551234"
  Action: mcp_call → customer_list({phone: "4165551234"})
  → Result: null (not found)

EVALUATOR:
  ✓ Required fields present
  Transition: customer_id === null → toNode = "create_customer"

[NODE: create_customer]
WORKER:
  Action: collect_data [customer_address, customer_city]
  → Response: "Thanks Sarah! What's your service address?"

USER: "123 Main St, Toronto"

WORKER:
  Extract: customer_address = "123 Main St", customer_city = "Toronto"
  Action: mcp_call → customer_create({name, phone, address, city})
  → Result: {id: "uuid-123", code: "CUST-001"}
  Engaging message: "Setting up your account in our system..." ✨

EVALUATOR:
  ✓ MCP success, customer_id = "uuid-123"
  Transition: default → toNode = "gather_booking_requirements"

[NODE: gather_booking_requirements]
WORKER:
  Action: collect_data [service_category, desired_date, job_description]
  → Response: "Perfect! When would you like us to come?"

[... continue through nodes ...]

[NODE: confirm_and_summarize]
WORKER:
  Action: summarize
  → Response: "You're all set, Sarah! ✨
      📅 Booking Confirmed
      Service: Landscaping
      Date: 2025-11-15 at 09:00 AM
      Booking #: TASK-20251106-0042"

ORCHESTRATOR:
  ✓ No nextNode → completed = true
  ✓ Generate summary, save to orchestrator_summary
  ✓ completeSession(status = 'completed')

Response: { sessionId, response, completed: true, endReason: "completed" }
```

### Example 2: Off-Topic Handling

```
USER: "What's the weather tomorrow?"

CRITIC:
  ✗ Topic forbidden (weather in forbiddenTopics)
  ✓ _off_topic_count = 1
  → Response: "I'm specifically here for service bookings... (first warning)"

USER: "Tell me a joke"

CRITIC:
  ✗ Topic forbidden again
  ✓ _off_topic_count = 2
  ✓ shouldEndConversation = true, endReason = "off_topic"

ORCHESTRATOR:
  ✓ completeSession(status = 'failed')
  ✓ closeChatSession(chat_session_id, reason = "off_topic")

Response: {
  response: "I'm specifically designed to help with our home services.
             For other questions, please visit our website.",
  conversationEnded: true,
  endReason: "off_topic"
}
```

### Example 3: Voice Booking

```
USER: [Speaks into mic] "I need service"
  ↓ MediaRecorder → Blob

FRONTEND:
  FormData { file: audioBlob, voice: "nova" }
  ↓ POST /orchestrator/voice

BACKEND:
  STT (Whisper): audioBlob → "I need service"
  ↓ processMessage(transcript)

ORCHESTRATOR:
  [Same flow as text chat above]
  ↓ response = "Can I get your name and phone number?"

  TTS (OpenAI): response → Audio/MP3 buffer

Response:
  Headers: { X-Transcript: "I need service", X-Response-Text: "Can I..." }
  Body: Audio/MP3 stream

FRONTEND:
  Audio.play(audioBlob)
  Display: transcript + response text
```

---

## 8. Critical Considerations When Building

### For Developers Extending This System

#### Adding New Intents

```typescript
// 1. Create graph file
// orchestrator/intent-graphs/complaint-handling.graph.ts
export const ComplaintHandlingGraph: IntentGraph = {
  name: 'ComplaintHandling',
  startNode: 'collect_complaint',
  nodes: { /* define nodes */ }
};

// 2. Register
// orchestrator/intent-graphs/index.ts
import { ComplaintHandlingGraph } from './complaint-handling.graph.js';
IntentGraphRegistry.ComplaintHandling = ComplaintHandlingGraph;

// 3. Update detection
// orchestrator.service.ts → detectIntent()
if (message.includes('complaint') || message.includes('issue')) {
  return { intent: 'ComplaintHandling', confidence: 0.9 };
}
```

#### State Management Best Practices

```typescript
// ✅ DO: Use setState for all critical data
await stateManager.setState(sessionId, 'customer_id', customerId, {
  source: 'worker',
  node_context: 'create_customer',
  validated: true
});

// ✅ DO: Mark validated after Evaluator checks
await stateManager.setState(sessionId, 'desired_date', date, {
  validated: true  // Evaluator confirmed
});

// ❌ DON'T: Store in memory only
this.tempData = { customerId };  // Lost on crash!

// ✅ DO: Generate summaries periodically
if (messageCount % 10 === 0) {
  const summary = await generateSummary(sessionId);
  await stateManager.saveSummary({ session_id, summary_text: summary });
}
```

#### MCP Tool Calls

```typescript
// ✅ DO: Map state variables to tool args
inputMapping: {
  body_name: 'customer_name',        // state.customer_name
  body_phone: 'customer_phone',
  body_city: '"Toronto"'             // Literal (quoted)
}

// ✅ DO: Map tool results to state
outputMapping: {
  customer_id: 'id',                 // result.id
  customer_code: 'code',
  customer_email: 'primary_email'    // result.primary_email
}

// ❌ DON'T: Call MCP tools outside Worker agent
// Use Worker.executeAction({ type: 'mcp_call', ... })
```

#### Agent Coordination

```typescript
// ✅ DO: Let Orchestrator coordinate agents
const workerResult = await workerAgent.executeAction(...);
const criticResult = await criticAgent.reviewWorkerOutput(...);
const evalResult = await evaluatorAgent.evaluateNode(...);

// ❌ DON'T: Skip Critic or Evaluator
// They prevent hallucinations and enforce rules

// ✅ DO: Check shouldEndConversation
if (criticResult.shouldEndConversation) {
  await completeSession(sessionId, 'failed');
  await closeChatSession(chat_session_id, criticResult.endReason);
  return { conversationEnded: true };
}
```

#### Performance Optimization

```typescript
// ✅ DO: Use appropriate models per agent
AGENT_MODEL_CONFIG.critic.model = 'gpt-3.5-turbo';  // Fast checks

// ✅ DO: Limit state lookups
const state = await stateManager.getAllState(sessionId);  // Once per turn
// NOT: await getState(key) for every key

// ✅ DO: Index on common queries
CREATE INDEX idx_orchestrator_log_session
  ON orchestrator_agent_log(session_id, created_ts DESC);

// ✅ DO: Limit log retention
DELETE FROM orchestrator_agent_log
WHERE created_ts < NOW() - INTERVAL '30 days';
```

#### Error Handling

```typescript
// ✅ DO: Catch and log all errors
try {
  const result = await executeMCPTool(...);
} catch (error) {
  await stateManager.logAgentAction({
    session_id, agent_role: 'worker', success: false,
    error_message: error.message
  });
  return { success: false, naturalResponse: "Let me try another approach." };
}

// ✅ DO: Return user-friendly errors
// ❌ "Error: pg_query failed with code 23505"
// ✅ "I had trouble creating that record. Let me try again."
```

#### Security

```typescript
// ✅ DO: Validate auth token before processing
const authResult = await authenticatorAgent.authenticate({
  sessionId, authToken, requiredPermissions: graph.requiredPermissions
});
if (!authResult.success) return { error: 'Unauthorized' };

// ✅ DO: Use RBAC at MCP layer
// All MCP calls include authToken → API enforces RBAC

// ❌ DON'T: Trust client-provided user_id
// Extract from validated JWT only

// ✅ DO: Sanitize PII in logs
await logAgentAction({
  mcp_tool_args: { phone: 'REDACTED' }  // Don't log full phone
});
```

#### Testing

```typescript
// ✅ DO: Test intent graphs independently
const graph = CalendarBookingGraph;
const node = graph.nodes['identify_customer'];
assert(node.transitions.length === 2);

// ✅ DO: Mock MCP calls in tests
jest.mock('../../mcp-adapter.service.js', () => ({
  executeMCPTool: jest.fn().mockResolvedValue({ id: 'mock-id' })
}));

// ✅ DO: Test conversation endings
const result = await criticAgent.reviewConversation({
  userMessage: "weather tomorrow",  // Off-topic
  state: { _off_topic_count: 1 }    // Second attempt
});
assert(result.shouldEndConversation === true);
```

---

## Quick Reference

### File Locations
```
apps/api/src/modules/chat/orchestrator/
├── agents/
│   ├── authenticator.agent.ts
│   ├── worker.agent.ts
│   ├── evaluator.agent.ts
│   └── critic.agent.ts
├── config/
│   ├── agent-models.config.ts
│   └── engaging-messages.config.ts
├── intent-graphs/
│   ├── calendar-booking.graph.ts
│   └── index.ts
├── state/
│   └── state-manager.service.ts
├── types/
│   └── intent-graph.types.ts
├── orchestrator.service.ts
├── orchestrator.routes.ts
├── voice-orchestrator.service.ts
└── voice-orchestrator.routes.ts

db/
├── 60_orchestrator_session.ddl
├── 61_orchestrator_state.ddl
├── 62_orchestrator_agent_log.ddl
└── 63_orchestrator_summary.ddl
```

### Environment Variables
```bash
OPENAI_API_KEY=sk-...           # Required for Whisper/TTS
ORCHESTRATOR_MODEL=gpt-3.5-turbo
WORKER_MODEL=gpt-3.5-turbo
EVALUATOR_MODEL=gpt-3.5-turbo
CRITIC_MODEL=gpt-3.5-turbo
```

### Cost Metrics
- **Text chat:** $0.02-0.05/conversation (with model optimization)
- **Voice chat:** $0.02-0.05/conversation (Whisper + TTS)
- **Savings:** 30-85% vs direct GPT-4 or Realtime API

### Performance
- **Text latency:** 500-2000ms (orchestrator + MCP)
- **Voice latency:** 1.7-5.5s (STT + orchestrator + TTS)
- **State lookups:** 5-10 queries/message
- **Token usage:** 500-1500 tokens/message (with summaries)

---

**Status:** Production Ready | **Version:** 1.1.0 | **Last Updated:** 2025-11-06
