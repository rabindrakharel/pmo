# AI Chat System - Building Blocks & Architecture Plan

> **Complete System Architecture Map** - Comprehensive breakdown of all components, layers, and their interactions

**Version:** 3.0.0 (Goal-Oriented Agentic Architecture)
**Last Updated:** 2025-11-09

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Building Blocks by Layer](#building-blocks-by-layer)
3. [Component Dependency Map](#component-dependency-map)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Technology Stack](#technology-stack)
6. [Design Patterns](#design-patterns)

---

## 🎯 System Overview

The AI Chat System is a **multi-modal conversational AI platform** supporting both **text chat** and **voice calls** with:

- **Goal-oriented agentic workflow** (5 business goals)
- **Hybrid branching** (deterministic + semantic routing)
- **Parallel agent execution** (50%+ performance boost)
- **Streaming responses** (text + audio)
- **MCP tool integration** (booking, customer management)
- **Declarative configuration** (zero hardcoded logic)

### Key Metrics

| Metric | Value |
|--------|-------|
| **Response Time (Text)** | First token: ~200-500ms |
| **Response Time (Voice)** | First audio: ~1 second |
| **Goals** | 5 (UNDERSTAND → GATHER → DESIGN → EXECUTE → CONFIRM) |
| **Agents** | 4 specialized agents + 1 orchestrator |
| **LLM Model** | GPT-4o mini (OpenAI) |
| **STT** | Deepgram Nova-2 |
| **TTS** | ElevenLabs Flash v2.5 (~75ms latency) |
| **Branching Types** | Deterministic, Semi-deterministic, Semantic |

---

## 🏗️ Building Blocks by Layer

### **Layer 1: Frontend (Client-Side)**

#### **1.1 Text Chat Widget**
**Location:** `/apps/widget/src/App.tsx`

**Responsibilities:**
- Render chat UI (messages, input, send button)
- Manage WebSocket/SSE connections for streaming
- Display typing indicators
- Handle user input

**Key Technologies:**
- React 19
- TypeScript
- Tailwind CSS v4

**API Integration:**
```typescript
// Session creation
POST /api/v1/chat/session/new
→ Returns: { session_id, greeting }

// Text messaging (non-streaming)
POST /api/v1/chat/message
→ Returns: { response, session_id }

// Text messaging (streaming)
POST /api/v1/chat/message/stream
→ SSE stream: { type: 'token' | 'done', token?, response? }
```

---

#### **1.2 Voice Call Widget**
**Location:** `/apps/widget/src/VoiceCall.tsx`

**Responsibilities:**
- Capture microphone audio (PCM16, 24kHz)
- Send audio chunks via WebSocket
- Receive and play audio responses progressively
- Show call status (idle, speaking, listening, processing)

**Audio Pipeline:**
```
User speaks → MediaRecorder (PCM16) →
  WebSocket chunks → API →
  Audio response (MP3) → AudioContext playback
```

**WebSocket Events:**
```typescript
// Client → Server
{ type: 'audio.append', audio: base64 }
{ type: 'audio.commit' }
{ type: 'audio.cancel' }

// Server → Client
{ type: 'processing.started' }
{ type: 'audio.chunk', audio: base64, transcript: string }
{ type: 'audio.done', session_id, intent, conversation_ended }
{ type: 'error', error: string }
```

---

### **Layer 2: API Routes (Backend Entry Points)**

#### **2.1 Text Chat Routes**
**Location:** `/apps/api/src/modules/chat/routes.ts`

**Endpoints:**

| Method | Endpoint | Purpose | Response Type |
|--------|----------|---------|---------------|
| POST | `/api/v1/chat/session/new` | Create new session | JSON |
| POST | `/api/v1/chat/message` | Send message (blocking) | JSON |
| POST | `/api/v1/chat/message/stream` | Send message (streaming) | SSE |
| GET | `/api/v1/chat/session/:id/history` | Get conversation history | JSON |
| POST | `/api/v1/chat/session/:id/close` | Close session | JSON |
| POST | `/api/v1/chat/session/:id/disconnect` | Disconnect (text/voice) | JSON |

**Key Features:**
- JWT authentication for MCP tools
- Session management (database persistence)
- SSE streaming for real-time responses
- Conversation history tracking

---

#### **2.2 Voice WebSocket Routes**
**Location:** `/apps/api/src/modules/chat/voice-langraph.routes.ts`

**Endpoint:**
```
GET /api/v1/chat/voice/call?name=NAME&email=EMAIL&token=JWT
```

**Connection Flow:**
```
Client → WebSocket upgrade →
  VoiceLangraphSession created →
  Initial greeting sent (TTS) →
  Audio chunks received/sent
```

**Session Management:**
- Global registry of active voice sessions
- Mapping: interaction_session_id ↔ voice_session_id
- Automatic cleanup on disconnect

---

### **Layer 3: Speech Processing**

#### **3.1 Deepgram STT (Speech-to-Text)**
**Location:** `/apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts:25`

**Function:** `speechToText(audioBuffer, audioFormat)`

**Configuration:**
```typescript
{
  model: 'nova-2',        // Latest Deepgram model
  language: 'en',
  smart_format: true,     // Auto punctuation
  punctuate: true
}
```

**Input:** WAV audio buffer
**Output:** Text transcript with confidence score

**Performance:**
- Latency: ~300-500ms
- Accuracy: 95%+ (smart formatting)

---

#### **3.2 ElevenLabs TTS (Text-to-Speech)**
**Location:** `/apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts:78`

**Function:** `textToSpeech(text, voice)`

**Configuration:**
```typescript
{
  model_id: 'eleven_flash_v2_5',  // Fastest model (~75ms)
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true
  },
  output_format: 'mp3_44100_128'
}
```

**Available Voices:**
- `nova` (female, energetic) - Default
- `alloy` (male, neutral)
- `echo` (male, crisp)
- `fable` (male, warm)
- `onyx` (male, deep)
- `shimmer` (female, soft)

**Performance:**
- Latency: ~75ms per chunk
- Streaming: Sentence-by-sentence buffering

---

#### **3.3 Voice Streaming Orchestrator**
**Location:** `/apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts:216`

**Function:** `processVoiceMessageStream()`

**Pipeline:**
```
Audio (WAV) → Deepgram STT → Transcript →
  Agent Orchestrator (streaming tokens) →
  Buffer until sentence boundary →
  ElevenLabs TTS → Audio chunk (MP3) →
  Yield to client
```

**Sentence Buffering Logic:**
```typescript
if (hasSentenceBoundary || textBuffer.length > 100) {
  // Send to TTS
  yield audio chunk
}
```

**Benefits:**
- First words play in <1 second
- Progressive audio playback
- Natural conversation flow

---

### **Layer 4: Multi-Agent Orchestration**

#### **4.1 Agent Orchestrator** (Main Coordinator)
**Location:** `/apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

**Responsibilities:**
- Coordinate multi-agent workflow
- Manage goal transitions
- Execute termination sequences
- Parallel agent execution
- Session state management

**Key Methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `processMessage()` | Process user message (blocking) | `{ response, sessionId, currentNode, ... }` |
| `processMessageStream()` | Process with streaming | AsyncGenerator `{ type, token, ... }` |
| `executeNode()` | Execute single goal | Agent response |
| `checkAdvance()` | Check goal transition | `{ shouldTransition, nextGoal }` |

**Workflow:**
```
1. Load/initialize session state
2. Determine primary agent for current goal
3. Execute agent(s) (parallel if configured)
4. Extract/update context data
5. Check goal transition conditions
6. Save state
7. Return response
```

---

#### **4.2 Worker Reply Agent** (Conversational)
**Location:** `/apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts`

**Purpose:** Generate natural language responses to customers

**ReAct Pattern:**
```typescript
async executeGoal(goalId, state, userMessage) {
  // 1. OBSERVE
  const observation = this.observe(goal, state, userMessage);

  // 2. THINK (via LLM prompt)
  const systemPrompt = this.buildReActPrompt(goal, observation, context);

  // 3. ACT
  const response = await openaiService.callAgent({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  return { response };
}
```

**Streaming Support:**
```typescript
async *executeGoalStream(goalId, state, userMessage) {
  for await (const chunk of openaiService.callAgentStream(...)) {
    yield { token: chunk.token, done: chunk.done };
  }
}
```

**Prompt Components:**
- Agent profile (identity, personality, capabilities)
- Goal description (current objective)
- Success criteria (what to achieve)
- Conversation tactics (empathetic_listening, clarifying_questions, etc.)
- Context values (customer name, service request, etc.)
- Recent conversation history

---

#### **4.3 Worker MCP Agent** (Tool Execution)
**Location:** `/apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts`

**Purpose:** Execute MCP tools (booking, customer lookup, etc.)

**Execution Flow:**
```typescript
async executeNode(nodeId, state, userMessage) {
  // 1. Determine next action via LLM
  const action = await this.getNextAction(goal, state, userMessage);

  // 2. Execute MCP tool
  if (action.tool_name) {
    const result = await mcpClient.executeTool(action.tool_name, action.params);
    return { response: result.summary };
  }

  // 3. Fallback to conversational response
  return { response: action.response };
}
```

**Available MCP Tools:**
- `customer_get` - Fetch customer by phone/email
- `customer_create` - Create new customer
- `task_create` - Create service task
- `person_calendar_book` - Book appointment
- `setting_list` - List settings/options
- `call_hangup` - Terminate chat session

---

#### **4.4 Data Extraction Agent**
**Location:** `/apps/api/src/modules/chat/orchestrator/agents/data-extraction-agent.service.ts`

**Purpose:** Extract structured data from conversation and update session memory

**Extraction Flow:**
```typescript
async extractAndUpdateContext(conversationHistory, currentContext, goal) {
  // 1. Build extraction prompt
  const prompt = this.buildExtractionPrompt(goal, conversationHistory, currentContext);

  // 2. Call LLM with JSON mode
  const result = await openaiService.callAgent({
    messages: [{ role: 'system', content: prompt }],
    jsonMode: true
  });

  // 3. Merge extracted data with current context
  const updatedContext = deepMerge(currentContext, result.extracted_data);

  return {
    contextUpdates: result.extracted_data,
    fieldsUpdated: Object.keys(result.extracted_data)
  };
}
```

**Extraction Schema:**
```json
{
  "customer": {
    "name": "string",
    "phone": "string",
    "email": "string"
  },
  "service": {
    "primary_request": "string",
    "urgency": "string"
  },
  "operations": {
    "solution_plan": "string",
    "task_id": "string"
  }
}
```

---

#### **4.5 Agent Context Service**
**Location:** `/apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts`

**Purpose:** Manage session state (context, current goal, conversation history)

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `createInitialState()` | Initialize new session |
| `appendConversationSummary()` | Add message to history |
| `updateContext()` | Merge context updates |
| `setCurrentNode()` | Change current goal |
| `markConversationEnded()` | End conversation |

**State Structure:**
```typescript
interface AgentContextState {
  sessionId: string;
  currentNode: string;  // Current goal ID
  context: ConversationContextV3;  // Flat session memory
  conversationSummary: Array<{ customer, agent }>;
  conversationEnded: boolean;
  endReason?: string;
}
```

---

### **Layer 5: Goal-Based Workflow Engine**

#### **5.1 Goal Transition Engine**
**Location:** `/apps/api/src/modules/chat/orchestrator/engines/goal-transition.engine.ts`

**Purpose:** Evaluate goal completion and determine next goal

**Hybrid Branching:**

```typescript
async checkGoalAdvancement(goal, context, conversationHistory) {
  // STEP 1: Evaluate DETERMINISTIC conditions (instant, no LLM)
  for (const condition of goal.auto_advance_conditions) {
    if (condition.type === 'deterministic') {
      const result = evaluateDeterministicCondition(
        context,
        condition.json_path,
        condition.operator,
        condition.value
      );
      if (result) {
        return { shouldTransition: true, nextGoal: condition.next_goal };
      }
    }
  }

  // STEP 2: Evaluate SEMANTIC conditions (LLM-based)
  const semanticResult = await this.evaluateSemanticConditions(...);
  return semanticResult;
}
```

**Condition Types:**

1. **Deterministic** (instant):
```json
{
  "type": "deterministic",
  "json_path": "customer.phone",
  "operator": "is_set",
  "next_goal": "DESIGN_SOLUTION"
}
```

2. **Semi-deterministic** (field presence):
```json
{
  "type": "semi_deterministic",
  "json_path": "service.primary_request",
  "operator": "is_set",
  "next_goal": "GATHER_REQUIREMENTS"
}
```

3. **Semantic** (LLM evaluation):
```json
{
  "type": "semantic",
  "condition": "customer has clearly stated their issue",
  "next_goal": "GATHER_REQUIREMENTS"
}
```

---

#### **5.2 Parallel Agent Executor**
**Location:** `/apps/api/src/modules/chat/orchestrator/engines/parallel-agent-executor.ts`

**Purpose:** Execute multiple agents simultaneously

**Execution Modes:**

1. **Sequential** (default):
```typescript
for (const agent of agents) {
  await agent.execute();
}
```

2. **Parallel** (50%+ faster):
```typescript
const results = await Promise.allSettled(
  agents.map(agent => agent.execute())
);
```

3. **Dependency Graph** (topological sort):
```typescript
const waves = buildExecutionWaves(executionGraph);
for (const wave of waves) {
  await Promise.all(wave.map(agent => agent.execute()));
}
```

**Configuration Example:**
```json
{
  "agent_execution_strategy": {
    "mode": "parallel",
    "parallel_groups": [
      {
        "agents": ["conversational_agent", "extraction_agent"],
        "description": "Reply + extract data in parallel"
      }
    ]
  }
}
```

**Performance Impact:**
- Sequential: 2000ms (1000ms reply + 1000ms extraction)
- Parallel: 1100ms (both run simultaneously)

---

#### **5.3 JSON Path Resolver**
**Location:** `/apps/api/src/modules/chat/orchestrator/utils/json-path-resolver.ts`

**Purpose:** Resolve JSON paths from session memory for deterministic conditions

**Key Functions:**

```typescript
// 1. Resolve nested JSON path
resolveJsonPath(context, 'customer.phone')
// → "+1234567890"

// 2. Evaluate deterministic condition
evaluateDeterministicCondition(context, 'customer.phone', 'is_set')
// → true

// 3. Replace placeholders in prompts
replacePlaceholders("Hello {{customer.name}}, ...", context)
// → "Hello John Smith, ..."

// 4. Check if value is set
isValueSet(value)
// → false for: null, undefined, "", [], {}
```

**Supported Operators:**
- `is_set` - Field has meaningful value
- `==` - Exact match
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal

---

### **Layer 6: LLM Services**

#### **6.1 OpenAI Service**
**Location:** `/apps/api/src/modules/chat/orchestrator/services/openai.service.ts`

**Purpose:** Wrapper for OpenAI API with streaming support

**Methods:**

```typescript
// 1. Blocking call
async callAgent(args: {
  agentType: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}) {
  const config = getAgentModelConfig(agentType);
  const result = await openai.chat.completions.create({
    model: config.model,  // gpt-4o-mini
    messages,
    temperature: config.temperature
  });
  return result.choices[0].message.content;
}

// 2. Streaming call
async *callAgentStream(args) {
  const stream = await openai.chat.completions.create({
    stream: true,
    ...
  });

  for await (const chunk of stream) {
    yield { token: chunk.choices[0]?.delta?.content || '' };
  }
}
```

**Agent Model Configuration:**
```typescript
{
  worker_reply: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 500 },
  worker_mcp: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 300 },
  data_extraction: { model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 500 },
  navigator: { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 200 }
}
```

---

#### **6.2 LLM Logger**
**Location:** `/apps/api/src/modules/chat/orchestrator/services/llm-logger.service.ts`

**Purpose:** Centralized logging for all LLM calls

**Logged Data:**
- Agent type
- Model used
- Messages (input)
- Response (output)
- Tokens used (prompt + completion)
- Cost (in cents)
- Latency (ms)
- Session ID
- Timestamp

**Storage:** PostgreSQL table `app.llm_call_log`

---

### **Layer 7: State Management**

#### **7.1 State Manager**
**Location:** `/apps/api/src/modules/chat/orchestrator/state/state-manager.service.ts`

**Purpose:** Persist agent state to database

**Key Methods:**

```typescript
// Save state
await stateManager.saveState(sessionId, state);

// Load state
const state = await stateManager.loadState(sessionId);

// Delete state (cleanup)
await stateManager.deleteState(sessionId);
```

**Storage:** In-memory Map (production would use Redis/Database)

---

#### **7.2 Session Memory Data Service**
**Location:** `/apps/api/src/modules/chat/orchestrator/services/session-memory-data.service.ts`

**Purpose:** CRUD operations on flat session memory (context)

**Key Methods:**

```typescript
// Get entire context
getSessionMemory(sessionId);

// Get specific field
getSessionField(sessionId, 'customer.phone');

// Set field
setSessionField(sessionId, 'customer.phone', '+1234567890');

// Update multiple fields
updateSessionMemory(sessionId, { customer: { name: 'John' } });
```

**MCP Integration:**
Exposed as MCP tools for agents to read/write session memory dynamically.

---

### **Layer 8: MCP (Model Context Protocol)**

#### **8.1 MCP Client**
**Location:** `/apps/api/src/modules/chat/orchestrator/mcp/` (assumed)

**Purpose:** Connect to MCP server and execute tools

**Available Tools:**

| Tool | Purpose | Parameters |
|------|---------|------------|
| `customer_get` | Fetch customer | `{ phone?, email? }` |
| `customer_create` | Create customer | `{ name, phone, email }` |
| `task_create` | Create service task | `{ title, description, ... }` |
| `person_calendar_book` | Book appointment | `{ person_id, start_time, end_time }` |
| `setting_list` | List settings | `{ category }` |
| `call_hangup` | End chat session | `{}` |
| `session_memory_get` | Get session field | `{ field_path }` |
| `session_memory_set` | Set session field | `{ field_path, value }` |

---

#### **8.2 Session Memory MCP Tools**
**Location:** `/apps/api/src/modules/chat/orchestrator/mcp/session-memory-data-mcp.tools.ts`

**Purpose:** Allow agents to read/write session memory via MCP

**Example:**
```typescript
// Agent calls MCP tool
const result = await mcpClient.executeTool('session_memory_get', {
  field_path: 'customer.phone'
});
// → { value: '+1234567890' }
```

---

### **Layer 9: Configuration**

#### **9.1 Agent Configuration** (Declarative)
**Location:** `/apps/api/src/modules/chat/orchestrator/agent_config.json`

**Structure:**
```json
{
  "version": "3.0.0",
  "architecture": "goal-oriented-agentic",

  "goals": [
    {
      "goal_id": "UNDERSTAND_REQUEST",
      "description": "...",
      "goal_type": "conversational",
      "is_terminal": false,
      "primary_agent": "conversational_agent",
      "success_criteria": { ... },
      "auto_advance_conditions": [ ... ],
      "retry_strategy": { ... },
      "termination_sequence": { ... }
    }
  ],

  "agent_profiles": {
    "conversational_agent": { ... },
    "mcp_agent": { ... },
    "planner_agent": { ... },
    "extraction_agent": { ... }
  },

  "conversation_tactics": { ... }
}
```

**Key Components:**

1. **Goals** - Business objectives (5 goals)
2. **Agent Profiles** - Agent identities, capabilities, system prompts
3. **Conversation Tactics** - Reusable behavioral patterns
4. **Success Criteria** - Mandatory/conditional fields for goal completion
5. **Advance Conditions** - Hybrid branching rules
6. **Retry Strategies** - Escalation messages, loop prevention
7. **Termination Sequences** - Goodbye + MCP hangup

---

#### **9.2 Agent Config Schema**
**Location:** `/apps/api/src/modules/chat/orchestrator/config/agent-config.schema.ts`

**TypeScript Types:**
```typescript
interface ConversationGoal {
  goal_id: string;
  description: string;
  goal_type: 'conversational' | 'conversational_with_mcp' | 'planning' | 'execution' | 'terminal';
  is_terminal: boolean;
  primary_agent: string;
  fallback_agent?: string;
  success_criteria: SuccessCriteria;
  allowed_agents: string[];
  available_tools?: string[];
  conversation_tactics: string[];
  max_turns: number;
  retry_strategy: RetryStrategy;
  auto_advance_conditions: AdvanceCondition[];
  termination_sequence?: TerminationSequence;
  agent_execution_strategy?: AgentExecutionStrategy;
}
```

---

#### **9.3 Config Loader**
**Location:** `/apps/api/src/modules/chat/orchestrator/config/config-loader.service.ts`

**Purpose:** Load and validate agent configuration

```typescript
const config = loadAgentConfig();
// → AgentConfigV3 (validated schema)
```

---

### **Layer 10: Database**

#### **10.1 Chat Sessions Table**
**Table:** `app.chat_interaction`

**Schema:**
```sql
CREATE TABLE app.chat_interaction (
  session_id UUID PRIMARY KEY,
  customer_id UUID,
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  conversation_history JSONB,  -- Array of { role, content, timestamp }
  total_tokens INT,
  total_cost_cents INT,
  booking_created_flag BOOLEAN,
  closed_flag BOOLEAN,
  resolution VARCHAR(50),  -- 'resolved', 'abandoned', 'escalated'
  metadata JSONB,  -- { orchestrator_session_id, current_intent, current_node }
  created_ts TIMESTAMPTZ,
  updated_ts TIMESTAMPTZ
);
```

---

#### **10.2 LLM Call Logs Table**
**Table:** `app.llm_call_log`

**Schema:**
```sql
CREATE TABLE app.llm_call_log (
  id UUID PRIMARY KEY,
  session_id UUID,
  agent_type VARCHAR(50),
  model VARCHAR(100),
  messages JSONB,
  response TEXT,
  tokens_used INT,
  prompt_tokens INT,
  completion_tokens INT,
  cost_cents DECIMAL(10,2),
  latency_ms INT,
  created_ts TIMESTAMPTZ
);
```

---

## 🔗 Component Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
├──────────────────────┬──────────────────────────────────────┤
│  Text Chat Widget    │       Voice Call Widget              │
│  (App.tsx)           │       (VoiceCall.tsx)                │
└──────────┬───────────┴────────────────┬─────────────────────┘
           │                            │
           ▼ HTTP/SSE                   ▼ WebSocket
┌──────────────────────────────────────────────────────────────┐
│                         API LAYER                            │
├──────────────────────┬──────────────────────────────────────┤
│  Text Chat Routes    │    Voice WebSocket Routes            │
│  (routes.ts)         │    (voice-langraph.routes.ts)        │
└──────────┬───────────┴────────────────┬─────────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION LAYER                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Agent Orchestrator Service                  │   │
│  │  (agent-orchestrator.service.ts)                    │   │
│  └───────────┬─────────────────────────────────────────┘   │
│              │                                              │
│              ├──→ Worker Reply Agent                        │
│              ├──→ Worker MCP Agent                          │
│              ├──→ Data Extraction Agent                     │
│              ├──→ Goal Transition Engine                    │
│              └──→ Parallel Agent Executor                   │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    LLM SERVICES LAYER                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ OpenAI       │  │  LLM Logger  │  │ Agent Context  │    │
│  │ Service      │  │  Service     │  │ Service        │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
└──────────────────────┬───────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│  VOICE PROCESSING    │  │    MCP LAYER         │
│                      │  │                      │
│  ┌────────────────┐ │  │  ┌────────────────┐ │
│  │ Deepgram STT   │ │  │  │ MCP Client     │ │
│  │ (Nova-2)       │ │  │  │                │ │
│  └────────────────┘ │  │  └────────────────┘ │
│                      │  │                      │
│  ┌────────────────┐ │  │  ┌────────────────┐ │
│  │ ElevenLabs TTS │ │  │  │ Session Memory │ │
│  │ (Flash v2.5)   │ │  │  │ MCP Tools      │ │
│  └────────────────┘ │  │  └────────────────┘ │
└──────────────────────┘  └──────────────────────┘
           │                       │
           └───────────┬───────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ State        │  │  Session     │  │ Context        │    │
│  │ Manager      │  │  Memory      │  │ Initializer    │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ chat_        │  │  llm_call_   │  │ agent_state    │    │
│  │ interaction  │  │  log         │  │ (in-memory)    │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### **Text Chat Flow (Streaming)**

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. User types message
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/v1/chat/message/stream   │
│  Body: { session_id, message }      │
└─────────────┬───────────────────────┘
              │
              │ 2. Setup SSE connection
              │
              ▼
┌──────────────────────────────────────┐
│   Agent Orchestrator                 │
│   processMessageStream()             │
└──────────┬───────────────────────────┘
           │
           │ 3. Stream tokens from LLM
           │
           ▼
┌─────────────────────────────────────┐
│   Worker Reply Agent                │
│   executeGoalStream()               │
└──────────┬──────────────────────────┘
           │
           │ 4. Stream tokens from OpenAI
           │
           ▼
┌─────────────────────────────────────┐
│   OpenAI Service                    │
│   callAgentStream()                 │
└──────────┬──────────────────────────┘
           │
           │ 5. Yield tokens as they arrive
           │
           ▼
┌─────────────────────────────────────┐
│   SSE Response                      │
│   data: {"type":"token","token":"Hi"}│
│   data: {"type":"token","token":" there"} │
│   data: {"type":"done","response":"Hi there"} │
└──────────┬──────────────────────────┘
           │
           │ 6. Display tokens progressively
           │
           ▼
┌─────────────┐
│   User      │
│  (Browser)  │
└─────────────┘
```

---

### **Voice Call Flow (Streaming TTS)**

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. User speaks into microphone
       │
       ▼
┌─────────────────────────────────────┐
│  WebSocket Connection               │
│  /api/v1/chat/voice/call            │
└─────────────┬───────────────────────┘
              │
              │ 2. Send audio chunks
              │    { type: 'audio.append', audio: base64 }
              │    { type: 'audio.commit' }
              │
              ▼
┌──────────────────────────────────────┐
│   Voice Langraph Session             │
│   processAudio()                     │
└──────────┬───────────────────────────┘
           │
           │ 3. Convert PCM16 → WAV
           │
           ▼
┌─────────────────────────────────────┐
│   Voice Orchestrator                │
│   processVoiceMessageStream()       │
└──────────┬──────────────────────────┘
           │
           │ 4. Speech-to-Text (Deepgram)
           │
           ▼
┌─────────────────────────────────────┐
│   Deepgram STT                      │
│   speechToText()                    │
└──────────┬──────────────────────────┘
           │
           │ 5. Transcript: "I need help"
           │
           ▼
┌─────────────────────────────────────┐
│   Agent Orchestrator                │
│   processMessageStream()            │
└──────────┬──────────────────────────┘
           │
           │ 6. Stream response tokens
           │    "I'd" "be" "happy" "to" "help"
           │
           ▼
┌─────────────────────────────────────┐
│   Voice Orchestrator (Buffering)    │
│   Buffer until sentence boundary    │
└──────────┬──────────────────────────┘
           │
           │ 7. Buffer: "I'd be happy to help."
           │
           ▼
┌─────────────────────────────────────┐
│   ElevenLabs TTS                    │
│   textToSpeech()                    │
└──────────┬──────────────────────────┘
           │
           │ 8. Audio chunk (MP3)
           │
           ▼
┌─────────────────────────────────────┐
│   WebSocket Response                │
│   { type: 'audio.chunk', audio: ... } │
└──────────┬──────────────────────────┘
           │
           │ 9. Play audio progressively
           │
           ▼
┌─────────────┐
│   User      │
│  (Browser)  │
└─────────────┘
```

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework:** React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Build:** Vite
- **Audio:** MediaRecorder API, AudioContext

### **Backend**
- **Framework:** Fastify v5
- **Language:** TypeScript (ESM)
- **Runtime:** Node.js
- **Database:** PostgreSQL 14+
- **ORM:** Raw SQL (no ORM)

### **AI/ML Services**
- **LLM:** OpenAI GPT-4o mini
- **STT:** Deepgram Nova-2
- **TTS:** ElevenLabs Flash v2.5

### **Communication**
- **Text Streaming:** Server-Sent Events (SSE)
- **Voice:** WebSocket (ws library)

### **State Management**
- **Session State:** In-memory Map (production: Redis recommended)
- **Database:** PostgreSQL

---

## 🎨 Design Patterns

### **1. Goal-Oriented Architecture**
**Pattern:** Replace rigid state machines with flexible business goals

**Before:**
```
17 hardcoded nodes → rigid transitions → brittle logic
```

**After:**
```
5 business goals → hybrid branching → flexible logic
```

**Benefits:**
- Declarative configuration (no code changes)
- Semantic routing (LLM evaluates conditions)
- Easy to add/modify goals

---

### **2. ReAct Pattern (Reason + Act)**
**Pattern:** Agents observe, think, then act

```typescript
// 1. OBSERVE
const observation = {
  currentGoal: "Understand customer request",
  context: { customer: { name: "John" } },
  recentConversation: [...]
};

// 2. THINK (via LLM)
const systemPrompt = `
  You are an empathetic customer service agent.
  Current goal: ${observation.currentGoal}
  Customer: ${observation.context.customer.name}
  Recent conversation: ${observation.recentConversation}

  What should you say next?
`;

// 3. ACT
const response = await llm.call(systemPrompt);
```

---

### **3. Hybrid Branching**
**Pattern:** Combine fast (deterministic) + flexible (semantic) conditions

```typescript
// Fast path (instant)
if (context.customer.phone) {
  return 'DESIGN_SOLUTION';
}

// Slow path (LLM evaluation)
const shouldAdvance = await llm.evaluate(
  "Has the customer clearly stated their issue?"
);
if (shouldAdvance) {
  return 'GATHER_REQUIREMENTS';
}
```

**Benefits:**
- 90% of transitions use fast path
- 10% use semantic routing for edge cases
- Best of both worlds

---

### **4. Parallel Execution**
**Pattern:** Run independent agents simultaneously

```typescript
// Sequential (slow)
const reply = await conversationalAgent.execute();  // 1000ms
const extraction = await extractionAgent.execute(); // 1000ms
// Total: 2000ms

// Parallel (fast)
const [reply, extraction] = await Promise.all([
  conversationalAgent.execute(),  // 1000ms
  extractionAgent.execute()       // 1000ms
]);
// Total: 1100ms (50% faster)
```

---

### **5. Progressive Streaming**
**Pattern:** Yield results incrementally instead of blocking

**Text Streaming:**
```typescript
async function* streamResponse() {
  for await (const token of llm.stream()) {
    yield { type: 'token', token };
  }
  yield { type: 'done', response: fullResponse };
}
```

**Voice Streaming:**
```typescript
async function* streamVoiceResponse() {
  let buffer = '';
  for await (const token of llm.stream()) {
    buffer += token;
    if (hasSentenceBoundary(buffer)) {
      const audio = await tts(buffer);
      yield { type: 'audio', audio };
      buffer = '';
    }
  }
}
```

---

### **6. Declarative Configuration**
**Pattern:** Define behavior in JSON, not code

**Benefits:**
- Non-developers can modify workflows
- A/B testing via config changes
- Version control for behavior
- Zero code deployment

**Example:**
```json
{
  "goal_id": "GATHER_REQUIREMENTS",
  "primary_agent": "conversational_agent",
  "retry_strategy": {
    "escalation_messages": [
      "Try a different approach",
      "Offer value proposition"
    ]
  }
}
```

---

### **7. Termination Sequences**
**Pattern:** Declarative goodbye + cleanup

```json
{
  "termination_sequence": {
    "steps": [
      {
        "step": 1,
        "action": "conversational_goodbye",
        "agent": "conversational_agent",
        "message_template": "Thank you!"
      },
      {
        "step": 2,
        "action": "execute_mcp_hangup",
        "agent": "mcp_agent",
        "required_tool": "call_hangup"
      }
    ]
  }
}
```

---

## 📁 File Organization

```
/apps/api/src/modules/chat/
├── orchestrator/
│   ├── agent_config.json              # 🎯 Declarative configuration
│   ├── agents/
│   │   ├── agent-orchestrator.service.ts     # Main coordinator
│   │   ├── worker-reply-agent.service.ts     # Conversational agent
│   │   ├── worker-mcp-agent.service.ts       # Tool execution agent
│   │   ├── data-extraction-agent.service.ts  # Context updater
│   │   └── agent-context.service.ts          # State manager
│   ├── engines/
│   │   ├── goal-transition.engine.ts         # Hybrid branching
│   │   └── parallel-agent-executor.ts        # Parallel execution
│   ├── services/
│   │   ├── openai.service.ts                 # LLM wrapper
│   │   ├── llm-logger.service.ts             # Call logging
│   │   └── session-memory-data.service.ts    # Session memory CRUD
│   ├── config/
│   │   ├── agent-config.schema.ts            # TypeScript types
│   │   ├── agent-models.config.ts            # LLM model configs
│   │   └── config-loader.service.ts          # Config validator
│   ├── mcp/
│   │   └── session-memory-data-mcp.tools.ts  # MCP session memory tools
│   ├── utils/
│   │   └── json-path-resolver.ts             # JSON path utilities
│   └── voice-orchestrator.service.ts         # Voice processing
├── routes.ts                          # Text chat API routes
├── voice-langraph.routes.ts           # Voice WebSocket routes
└── voice-langraph.service.ts          # Voice session manager

/apps/widget/src/
├── App.tsx                            # Text chat widget
├── VoiceCall.tsx                      # Voice call widget
└── api.ts                             # API client
```

---

## 🎓 Next Steps

1. **Read Full Documentation:**
   - See `AI_CHAT_SYSTEM.md` for comprehensive details
   - See `STREAMING_GUIDE.md` for streaming implementation

2. **Explore Code:**
   - Start with `agent-orchestrator.service.ts`
   - Read `agent_config.json` to understand goals
   - Check `voice-orchestrator.service.ts` for voice flow

3. **Test System:**
   - Use `/tools/test-api.sh` for API testing
   - Test text chat: `POST /api/v1/chat/message/stream`
   - Test voice: Connect to `/api/v1/chat/voice/call`

4. **Extend System:**
   - Add new goals in `agent_config.json`
   - Create new MCP tools for custom actions
   - Customize agent prompts and tactics

---

**Last Updated:** 2025-11-09
**Version:** 3.0.0
**Architecture:** Goal-Oriented Agentic with Streaming
