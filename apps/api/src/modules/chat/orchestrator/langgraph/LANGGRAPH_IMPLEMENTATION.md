# LangGraph Conversational AI Orchestrator

**Purpose**: 14-step conversational AI workflow for customer service automation using LangGraph state machine framework with progressive context building, empathetic interaction, and MCP tool integration.

**Version**: 1.0.0
**Status**: Production-Ready
**Last Updated**: 2025-11-07

---

## 1. Semantics & Business Context

### What This System Does

Orchestrates multi-turn customer service conversations through a 14-step workflow that progressively builds context, shows empathy, gathers customer information, plans actions using available MCP tools, executes those actions, and gracefully handles multiple requests in a single session.

### Business Requirements Addressed

1. **Progressive Context Building**: Each conversation step adds to accumulated customer context (identity, issue, service catalog match, related entities)
2. **Empathetic Interaction**: Dedicated steps for empathy and rapport building before asking for information
3. **Smart Data Gathering**: One field at a time, validates completeness before proceeding
4. **Action Planning & Execution**: LLM-powered planning using available MCP tool catalog, customer approval before execution
5. **Multi-Request Handling**: After resolving one issue, can handle additional requests in same conversation
6. **Conversation Continuity**: Resume conversations across server restarts using session-based checkpointing

### Use Cases

- Voice-based customer service calls (primary)
- Text-based chat support
- Service appointment booking
- Issue resolution workflows
- Multi-issue support sessions

---

## 2. Architecture & DRY Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph Orchestrator                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              StateGraph (LangGraph)                   │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  14 Nodes (I-XIII + ERROR)                     │  │  │
│  │  │  - I_greet_customer                            │  │  │
│  │  │  - II_ask_about_need                           │  │  │
│  │  │  - III_identify_issue (MCP)                    │  │  │
│  │  │  - IV_empathize                                │  │  │
│  │  │  - V_build_rapport                             │  │  │
│  │  │  - VI_gather_customer_data                     │  │  │
│  │  │  - VII_check_existing_customer (MCP)           │  │  │
│  │  │  - VIII_plan_actions (MCP)                     │  │  │
│  │  │  - IX_communicate_plan                         │  │  │
│  │  │  - X_execute_plan (MCP)                        │  │  │
│  │  │  - XI_communicate_execution                    │  │  │
│  │  │  - XIb_ask_another_request                     │  │  │
│  │  │  - XII_goodbye                                 │  │  │
│  │  │  - XIII_hangup                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Conditional Edges (Smart Routing)             │  │  │
│  │  │  - Issue change detection → III_identify_issue │  │  │
│  │  │  - Data update → VI_gather_customer_data       │  │  │
│  │  │  - Missing data → END (wait for user)          │  │  │
│  │  │  - Another request → III_identify_issue        │  │  │
│  │  │  - No more requests → XII_goodbye              │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  State Management                              │  │  │
│  │  │  - MemorySaver Checkpointer (in-memory)        │  │  │
│  │  │  - State reducers (auto-merge context)         │  │  │
│  │  │  - Thread-based session tracking               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        MCP Adapter Service Integration               │  │
│  │  - customer_search (lookup by phone)                 │  │
│  │  - customer_create (new profile)                     │  │
│  │  - setting_list (service catalog)                    │  │
│  │  - Tool execution with auth token                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        OpenAI Service (LLM Calls)                    │  │
│  │  - Worker agent (context-aware responses)            │  │
│  │  - Planner agent (action planning)                   │  │
│  │  - Temperature tuning per use case                   │  │
│  │  - JSON mode for structured extraction               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        State Manager (Database Backup)               │  │
│  │  - d_session_state table persistence                 │  │
│  │  - d_agent_log audit trail                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Conversation Flow Diagram

```
START
  ↓
[I_greet_customer] ──────────────────┐
  ↓                                   │
[II_ask_about_need]                  │
  ↓                                   │
[III_identify_issue] ←───────────┐   │
  ↓                               │   │
[IV_empathize]                    │   │
  ↓                               │   │
[V_build_rapport]                 │   │
  ↓                               │   │
[VI_gather_customer_data] ────→ END  │  (Wait for user input)
  ↓                         (missing data)
[VII_check_existing_customer]         │
  ↓                                   │
[VIII_plan_actions]                  │
  ↓                                   │
[IX_communicate_plan]                │
  ↓                                   │
[X_execute_plan]                     │
  ↓                                   │
[XI_communicate_execution]           │
  ↓                                   │
[XIb_ask_another_request] ────→ END  │  (Wait for user response)
  ↓                          │        │
  ├─ "Yes/I need help" ──────┘        │
  │                                   │
  └─ "No/Thanks" ───────────────────┘
       ↓
   [XII_goodbye]
       ↓
   [XIII_hangup]
       ↓
      END
```

### DRY Design Patterns

#### 1. **Node Wrapper Pattern**

All node functions use a unified wrapper that handles:
- Step completion checking
- State format conversion (LangGraph ↔ Original)
- Automatic step marking
- Return value transformation

```typescript
private wrapNode(
  nodeFunc: (state: OriginalAgentState) => Promise<Partial<OriginalAgentState>>,
  nodeName: NodeName
) {
  return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
    // Skip if already completed
    if (this.shouldSkipStep(nodeName, state)) {
      return {};
    }

    // Convert state format
    const originalState = this.toOriginalState(state);

    // Execute node logic
    const result = await nodeFunc(originalState);

    // Mark step completed
    this.markStepCompleted(nodeName, state);

    // Return LangGraph format
    return this.toLangGraphUpdate(result);
  };
}
```

**Variants**:
- `wrapNode()`: Simple nodes (no external dependencies)
- `wrapNodeWithMCP()`: Nodes needing MCP adapter + auth token
- `wrapNodeWithMCPOnly()`: Nodes needing only MCP adapter
- `wrapNodeForHangup()`: Special handling for voice hangup
- `wrapNodeForError()`: Error state handling

#### 2. **Context Injection Pattern**

Every LLM call receives accumulated context:

```typescript
function injectContextIntoPrompt(basePrompt: string, context: CustomerContext): string {
  const contextString = buildContextString(context);
  return `📊 ACCUMULATED CONTEXT SO FAR:
${contextString}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${basePrompt}`;
}
```

Ensures LLM has full conversation history and customer data at every decision point.

#### 3. **State Reducer Pattern**

LangGraph automatically merges state updates:

```typescript
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),  // Append messages
  }),
  context: Annotation<Partial<CustomerContext>>({
    reducer: (x, y) => ({ ...x, ...y }),  // Merge context objects
  }),
  customer_profile: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),  // Merge profiles
  }),
  // ... other fields with reducers
});
```

No manual state merging required—reducers handle it declaratively.

#### 4. **Smart Routing Pattern**

Conditional edges with priority-based detection:

```typescript
private routeFromNode(currentNode: NodeName, state: LangGraphState): NodeName | typeof END {
  // Priority 1: Issue change detection
  if (this.detectIssueChange(state)) {
    this.resetStepsFrom('III_identify_issue', state, true);
    return NODES.IDENTIFY;
  }

  // Priority 2: Data update detection
  const dataField = this.detectDataUpdateRequest(state);
  if (dataField) {
    state.context.steps_completed.VI_gather_data = false;
    return NODES.GATHER;
  }

  // Priority 3: Node-specific routing
  switch (currentNode) {
    case NODES.GATHER:
      const hasRequiredData = this.validateCustomerData(state);
      return hasRequiredData ? NODES.CHECK : END;  // ⚠️ Critical: END prevents infinite loop

    case NODES.ASK_ANOTHER:
      const wantsMore = this.detectUserIntent(state);
      return wantsMore ? NODES.IDENTIFY : NODES.GOODBYE;

    default:
      return this.getNextSequentialNode(currentNode);
  }
}
```

**Critical**: Returning `END` instead of same node prevents infinite loops when waiting for user input.

### Request Flow (Step-by-Step)

#### First Message (New Session)

```
1. POST /api/v1/chat/langgraph/message
   Body: { message: "[CALL_STARTED]" }

2. LangGraphOrchestratorService.processMessage()
   ├─ No sessionId → Generate new UUID
   ├─ Create session in d_session table
   └─ Call langGraphService.processMessage()

3. LangGraphStateGraphService.processMessage()
   ├─ No existingState → createInitialState()
   │  └─ Initialize steps_completed tracker (all false)
   ├─ Skip adding [CALL_STARTED] to messages
   ├─ Add _mcpAdapter and _authToken to state
   └─ graph.invoke(inputState, { configurable: { thread_id: sessionId } })

4. LangGraph Execution
   ├─ START → I_greet_customer
   │  └─ Return random greeting template
   ├─ I_greet_customer → II_ask_about_need
   │  └─ Ask "What brings you here today?"
   ├─ II_ask_about_need → III_identify_issue
   │  ├─ Call MCP: setting_list (service catalog)
   │  ├─ Call OpenAI: Extract structured data (JSON mode)
   │  └─ Update context with customer_main_ask, service_catalog match
   ├─ III_identify_issue → IV_empathize
   │  └─ Random empathy template with {issue} interpolation
   ├─ IV_empathize → V_build_rapport
   │  └─ Random rapport template
   ├─ V_build_rapport → VI_gather_customer_data
   │  ├─ Check missing fields (phone, name, email, address)
   │  ├─ Ask for phone number (first priority)
   │  └─ Route to END (wait for user response)
   └─ END

5. saveLangGraphState()
   └─ Save state snapshot to d_session_state table

6. Return response
   {
     sessionId: "uuid",
     response: "May I have your phone number?",
     currentNode: "I_greet_customer",
     completed: false,
     conversationEnded: false
   }
```

#### Subsequent Message (Resume Session)

```
1. POST /api/v1/chat/langgraph/message
   Body: { message: "555-123-4567", session_id: "uuid" }

2. LangGraphOrchestratorService.processMessage()
   ├─ sessionId exists → Resume session
   └─ Call langGraphService.getConversationHistory(sessionId)

3. LangGraphStateGraphService.getConversationHistory()
   └─ graph.getState({ configurable: { thread_id: sessionId } })
      └─ Returns last checkpointed state

4. LangGraphStateGraphService.processMessage()
   ├─ Use existingState (not createInitialState)
   ├─ Add user message to messages array
   └─ graph.invoke(inputState, { thread_id: sessionId })

5. LangGraph Execution (resumes from last checkpoint)
   ├─ Skip I-V (already completed)
   ├─ VI_gather_customer_data executes
   │  ├─ Extract phone from user message
   │  ├─ Update context.customer_phone_number
   │  ├─ Check: still missing name
   │  └─ Ask "Could I get your full name?"
   └─ Route to END (wait for next input)

6. Continue until all data gathered, then proceed to VII-XIII
```

---

## 3. Database, API & UI/UX Mapping

### Database Tables

#### d_session (Primary Session Tracking)
```sql
CREATE TABLE app.d_session (
  session_id UUID PRIMARY KEY,
  chat_session_id TEXT,  -- Voice call session reference
  user_id UUID,
  current_intent TEXT,   -- "CalendarBooking"
  current_node TEXT,     -- Current graph node
  status TEXT,           -- active | completed | error
  auth_metadata JSONB,   -- { authToken: "..." }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### d_session_state (State Snapshots)
```sql
CREATE TABLE app.d_session_state (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES app.d_session(session_id),
  state_key TEXT,        -- e.g., "messages", "context", "customer_profile"
  state_value JSONB,
  metadata JSONB,        -- { source: "langgraph", node_context: "...", validated: true }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### d_agent_log (Audit Trail)
```sql
CREATE TABLE app.d_agent_log (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES app.d_session(session_id),
  agent_name TEXT,       -- "worker" | "planner"
  action TEXT,           -- Node name
  input_data JSONB,
  output_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

#### POST /api/v1/chat/langgraph/message
**Process a message through LangGraph orchestrator**

Request:
```json
{
  "message": "I have holes in my backyard with dying grass",
  "session_id": "uuid-optional",
  "chat_session_id": "voice-session-id-optional",
  "user_id": "user-uuid-optional"
}
```

Response:
```json
{
  "sessionId": "generated-or-provided-uuid",
  "response": "May I have your phone number so I can better assist you?",
  "intent": "CalendarBooking",
  "currentNode": "I_greet_customer",
  "requiresUserInput": true,
  "completed": false,
  "conversationEnded": false,
  "endReason": null,
  "debugLogs": [
    {
      "timestamp": "2025-11-07T03:46:28.450Z",
      "node": "identifyIssueNode",
      "type": "llm_call",
      "model": "GPT-4 (worker)",
      "temperature": 0.3,
      "jsonMode": true,
      "systemPrompt": "...",
      "userPrompt": "...",
      "response": "..."
    }
  ]
}
```

Auth: Bearer token in `Authorization` header (JWT)

#### GET /api/v1/chat/langgraph/session/:id/status
**Get session status and full state**

Response:
```json
{
  "session": {
    "session_id": "uuid",
    "current_intent": "CalendarBooking",
    "current_node": "VI_gather_customer_data",
    "status": "active"
  },
  "state": {
    "messages": [...],
    "context": { ... },
    "completed": false
  },
  "logs": [...]  // Last 10 agent logs
}
```

#### GET /api/v1/chat/langgraph/intents
**List available intents/workflows**

Response:
```json
{
  "count": 1,
  "intents": [
    {
      "name": "CalendarBooking",
      "description": "Service appointment booking workflow"
    }
  ]
}
```

#### GET /api/v1/chat/langgraph/health
**Health check**

Response:
```json
{
  "status": "ok",
  "service": "LangGraph Orchestrator",
  "timestamp": "2025-11-07T03:46:28.450Z"
}
```

### Frontend Integration Points

**ChatWidget Component** (`apps/web/src/components/chat/ChatWidget.tsx`):
```typescript
// Send message to LangGraph orchestrator
const response = await fetch('/api/v1/chat/langgraph/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    message: userInput,
    session_id: currentSessionId,  // Maintain session
    user_id: userId
  })
});

const data = await response.json();

// Update UI
setMessages([...messages,
  { role: 'user', content: userInput },
  { role: 'assistant', content: data.response }
]);
setCurrentSessionId(data.sessionId);

// Handle conversation end
if (data.conversationEnded) {
  // Show "Conversation ended" message
  // Optionally close chat widget
}
```

**Voice Integration** (WebSocket-based):
```typescript
// Voice session starts → Initialize LangGraph session
const initResponse = await fetch('/api/v1/chat/langgraph/message', {
  method: 'POST',
  body: JSON.stringify({ message: '[CALL_STARTED]' })
});

const { sessionId } = await initResponse.json();

// For each voice transcript chunk
voiceSocket.on('transcript', async (text) => {
  const response = await fetch('/api/v1/chat/langgraph/message', {
    method: 'POST',
    body: JSON.stringify({
      message: text,
      session_id: sessionId,
      chat_session_id: voiceSessionId
    })
  });

  const data = await response.json();

  // Send AI response to text-to-speech
  textToSpeech(data.response);

  // Auto-disconnect if conversation ended
  if (data.conversationEnded) {
    disconnectVoiceSession(voiceSessionId);
  }
});
```

---

## 4. Central Configuration & Middleware

### Node Prompts Configuration (`prompts.config.ts`)

Centralized prompt templates for all 14 nodes:

```typescript
export const NODE_PROMPTS = {
  identify_issue: {
    system: (serviceCatalog: string, availableEntities: string[]) => `
      You are an intelligent customer service agent...
      Available Service Catalog: ${serviceCatalog}
      Available Entities: ${availableEntities.join(', ')}

      Output JSON: {
        customer_name, customer_phone_number, customers_main_ask,
        matching_service_catalog, related_entities
      }
    `,
    user: (customerMessage: string) => `Parse: "${customerMessage}"`
  },

  plan_actions: {
    system: `Create step-by-step plan using available MCP tools...`,
    user: (vars) => `Context: ${JSON.stringify(vars.customer_context)}
                     Available Tools: ${vars.available_mcp_tools.join(', ')}`
  },

  // ... all 14 node prompts
};
```

### Customer Context Type Definition

```typescript
export interface CustomerContext {
  who_are_you: string;

  // Customer Identity (persistent)
  customer_id?: string;
  customer_name?: string;
  customer_phone_number?: string;
  customer_email?: string;
  customers_street_address?: string;
  customers_city?: string;
  customers_province?: string;
  customers_zip_postal_code?: string;

  // Request/Issue Data (resettable)
  customers_main_ask: string;
  matching_service_catalog: string;
  related_entities: string[];
  next_steps_plan: string[];

  // Conversation Stage
  conversation_stage:
    | 'greeting'
    | 'asking_about_need'
    | 'identifying_issue'
    | 'empathizing'
    | 'building_rapport'
    | 'gathering_data'
    | 'checking_customer'
    | 'planning'
    | 'communicating_plan'
    | 'executing'
    | 'confirming_execution'
    | 'asking_another_request'
    | 'closing'
    | 'error';

  // Step Completion Tracking
  steps_completed?: StepCompletionTracker;
}

export interface StepCompletionTracker {
  I_greet: boolean;
  II_ask_need: boolean;
  III_identify_issue: boolean;
  IV_empathize: boolean;
  V_build_rapport: boolean;
  VI_gather_data: boolean;
  VII_check_customer: boolean;
  VIII_plan_actions: boolean;
  IX_communicate_plan: boolean;
  X_execute_plan: boolean;
  XI_communicate_execution: boolean;
}
```

### OpenAI Service Configuration (`services/openai.service.ts`)

Agent types with different model/temperature settings:

```typescript
const AGENT_CONFIGS = {
  worker: {
    model: 'gpt-4',
    temperature: 0.7,  // Creative responses
  },
  planner: {
    model: 'gpt-4',
    temperature: 0.2,  // Structured planning
  },
  critic: {
    model: 'gpt-4',
    temperature: 0.3,  // Analytical evaluation
  }
};

export async function callAgent(params: {
  agentType: 'worker' | 'planner' | 'critic';
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  jsonMode?: boolean;
}) {
  const config = AGENT_CONFIGS[params.agentType];

  return await openai.chat.completions.create({
    model: config.model,
    messages: params.messages,
    temperature: params.temperature ?? config.temperature,
    response_format: params.jsonMode ? { type: 'json_object' } : undefined
  });
}
```

### MCP Adapter Integration

```typescript
export class MCPAdapterService {
  async executeMCPTool(
    toolName: string,
    params: Record<string, any>,
    authToken: string
  ): Promise<any> {
    // Available tools:
    // - customer_search: { query_phone: string }
    // - customer_create: { body_primary_phone: string, body_primary_contact_name: string }
    // - setting_list: { query_datalabel: string }
    // - booking_create: { ... }

    const response = await fetch(`http://localhost:4000/api/v1/mcp/tool/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(params)
    });

    return await response.json();
  }
}
```

---

## 5. User Interaction Flow Examples

### Example 1: Backyard Holes & Dying Grass

**User Journey**:
```
Customer calls → AI answers → Customer describes issue → AI gathers info → AI plans solution → AI executes → Confirms → Goodbye
```

**Detailed Flow**:

```
1. [CALL_STARTED]
   AI: "Hey! How are you? How's it going? How can I help you today?"
   AI: "What brings you here today?"
   Node: II_ask_about_need

2. User: "I have holes in my backyard and my grass is dying"
   AI (Internal):
     - Calls MCP: setting_list(dl__service_category)
     - Calls GPT-4: Extract { customers_main_ask, matching_service_catalog, related_entities }
     - Result: { customers_main_ask: "holes in backyard with dying grass",
                 matching_service_catalog: "lawn_care_service",
                 related_entities: ["Customer", "Booking", "Task"] }

   AI: "I hear you, and I'm sorry that your issue is happening."
   AI: "No worries at all! I'm here to help you sort this out."
   AI: "May I have your phone number so I can better assist you?"
   Node: VI_gather_customer_data

3. User: "555-987-6543"
   AI (Internal):
     - Extracts phone: "555-987-6543"
     - Updates context.customer_phone_number
     - Still missing: customer_name

   AI: "Could I get your full name, please?"
   Node: VI_gather_customer_data (same node, different question)

4. User: "John Smith"
   AI (Internal):
     - Extracts name: "John Smith"
     - Updates context.customer_name
     - Has phone + name → Proceed to customer lookup
     - Calls MCP: customer_search({ query_phone: "555-987-6543" })
     - Result: Customer not found
     - Calls MCP: customer_create({ body_primary_phone: "555-987-6543",
                                    body_primary_contact_name: "John Smith" })
     - Result: { id: "new-customer-uuid" }

   AI: "Thank you! I've set up your profile. Let's get your issue resolved."
   Node: VII_check_existing_customer → VIII_plan_actions

5. AI (Internal - Planning):
   - Calls GPT-4 Planner:
     * Context: { customers_main_ask: "holes in backyard with dying grass",
                  matching_service_catalog: "lawn_care_service",
                  customer_id: "uuid", customer_name: "John Smith", ... }
     * Available MCP Tools: [booking_create, task_create, ...]
     * Returns: { next_steps_plan: [
         "1. Create lawn care service booking",
         "2. Schedule assessment visit",
         "3. Create follow-up task for grass treatment"
       ]}

   AI: "Here's what I'm going to do: First, I'll create a lawn care service booking for you.
        Then, I'll schedule an assessment visit for tomorrow between 2-5 PM. After that,
        I'll set up a follow-up task for grass treatment. Does that work for you?"
   Node: IX_communicate_plan

6. User: "Yes, that sounds good"
   AI (Internal):
     - Detects approval
     - Executes plan steps:
       * booking_create(...)
       * task_create(...)
     - Stores executed_actions

   AI: "All set! I've created booking #12345 for your lawn care assessment and scheduled
        the visit for tomorrow at 3 PM. You'll receive a confirmation email shortly.
        Is there anything else I can help you with today?"
   Node: XIb_ask_another_request

7. User: "No, that's all"
   AI (Internal):
     - Detects "no" → Route to GOODBYE

   AI: "Thank you for reaching out! Your service is all scheduled. Feel free to contact
        us anytime. Have a great day!"
   Node: XII_goodbye

   AI (Internal):
     - Auto-disconnect voice session (if voice call)

   [CALL_ENDED]
```

### Example 2: Multiple Requests in One Call

```
1. First issue: "My internet is not working"
   ... (steps I-XI as above)

2. AI: "Is there anything else I can help you with today?"
   User: "Yes, I also need to schedule a repair for my broken heater"

3. AI (Internal):
   - Detects "yes" + new request
   - Resets steps from III_identify_issue onwards
   - Preserves customer_id, customer_name, customer_phone_number
   - Clears customers_main_ask, matching_service_catalog, next_steps_plan

4. Routes back to III_identify_issue
   - Processes new issue: "broken heater"
   - Continues through steps IV-XIII
   - Completes second request

5. AI: "Is there anything else I can help you with today?"
   User: "No, thanks"

6. Routes to XII_goodbye → XIII_hangup → END
```

---

## 6. Critical Considerations When Building

### Architectural Decisions

#### 1. **Return END, Not Loop to Same Node**

**Problem**: Returning same node from conditional edge creates infinite loop.

**Solution**:
```typescript
case NODES.GATHER:
  const hasRequiredData = this.validateCustomerData(state);
  if (!hasRequiredData) {
    return END;  // ✅ CRITICAL: Wait for user input
  }
  return NODES.CHECK;
```

**Why**: LangGraph executes continuously until reaching `END`. Looping to same node will execute forever. Use `END` to pause and wait for next user message.

#### 2. **State Reducer Design**

All state fields use reducers for automatic merging:

```typescript
context: Annotation<Partial<CustomerContext>>({
  reducer: (x, y) => ({ ...x, ...y }),  // Shallow merge
}),

messages: Annotation<BaseMessage[]>({
  reducer: (x, y) => x.concat(y),  // Append arrays
}),
```

**Why**: Node functions return partial updates. Reducers merge them into accumulated state automatically.

#### 3. **Context Injection at Every Step**

```typescript
const userPromptWithContext = injectContextIntoPrompt(baseUserPrompt, state.context);
```

**Why**: LLM has no memory. Must receive full conversation context with every call to make informed decisions.

#### 4. **Step Completion Tracking**

```typescript
interface StepCompletionTracker {
  I_greet: boolean;
  II_ask_need: boolean;
  // ... all steps
}
```

**Why**: Enables intelligent skip logic when resuming conversations. If steps I-V already completed, jump directly to step VI.

#### 5. **Two-Layer Persistence**

- **Layer 1**: LangGraph MemorySaver checkpointer (in-memory, fast)
- **Layer 2**: PostgreSQL d_session_state table (persistent, backup)

**Why**: Checkpointer provides fast resume. Database provides durability across server restarts and analytics.

#### 6. **Node Wrapping Variants**

Different wrappers for different dependency needs:
- `wrapNode()`: No external dependencies
- `wrapNodeWithMCP()`: Needs MCP adapter + auth token
- `wrapNodeWithMCPOnly()`: Needs only MCP adapter

**Why**: DRY principle. Single wrapper logic, parameterized for different signatures.

### Implementation Patterns

#### Pattern 1: Adding a New Node

```typescript
// 1. Add node to NODES constant
export const NODES = {
  // ... existing nodes
  NEW_NODE: 'XIV_new_node_name',
} as const;

// 2. Create node function in graph-nodes.service.ts
export async function newNodeFunction(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`\n🎯 [XIV. NEW_NODE] ━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const context = state.context || {};

  // Node logic here

  return {
    messages: [...state.messages, { role: 'assistant', content: response }],
    context: { ...context, conversation_stage: 'new_stage' },
  };
}

// 3. Add to graph construction
workflow.addNode(NODES.NEW_NODE, this.wrapNode(newNodeFunction, NODES.NEW_NODE));

// 4. Add edges
workflow.addEdge(NODES.PREVIOUS_NODE, NODES.NEW_NODE);
workflow.addEdge(NODES.NEW_NODE, NODES.NEXT_NODE);

// 5. Update routing logic if conditional
workflow.addConditionalEdges(NODES.NEW_NODE, (state) => this.routeFromNode(NODES.NEW_NODE, state));

// 6. Add step completion tracking
interface StepCompletionTracker {
  // ... existing
  XIV_new_node: boolean;
}
```

#### Pattern 2: Adding MCP Tool Integration

```typescript
// In node function that needs MCP
export async function nodeWithMCP(
  state: AgentState,
  mcpAdapter: MCPAdapterService,
  authToken: string
): Promise<Partial<AgentState>> {

  // Call MCP tool
  const result = await mcpAdapter.executeMCPTool(
    'tool_name',
    { param1: value1, param2: value2 },
    authToken
  );

  // Process result
  const data = result.data;

  // Update context
  return {
    context: {
      ...state.context,
      new_field: data.extracted_value,
    },
  };
}

// Wrap with MCP variant
workflow.addNode(NODES.NODE_NAME, this.wrapNodeWithMCP(nodeWithMCP, NODES.NODE_NAME));
```

#### Pattern 3: Conditional Routing with Detection

```typescript
// Add detection function
private detectCustomCondition(state: LangGraphState): boolean {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || lastMessage._getType() !== 'human') return false;

  const userMessage = lastMessage.content.toString();
  const indicators = /keyword1|keyword2|keyword3/i;

  return indicators.test(userMessage);
}

// Use in routing
private routeFromNode(currentNode: NodeName, state: LangGraphState): NodeName | typeof END {
  // Check custom condition first
  if (this.detectCustomCondition(state)) {
    // Reset relevant steps
    this.resetStepsFrom('III_identify_issue', state, true);
    return NODES.TARGET_NODE;
  }

  // ... other routing logic
}
```

### Common Pitfalls

#### ❌ Don't: Loop to Same Node
```typescript
case NODES.GATHER:
  return !hasData ? NODES.GATHER : NODES.CHECK;  // INFINITE LOOP!
```

#### ✅ Do: Return END to Wait
```typescript
case NODES.GATHER:
  return !hasData ? END : NODES.CHECK;  // Correct
```

#### ❌ Don't: Forget to Pass Context
```typescript
const result = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Parse this message' }  // Missing context!
  ]
});
```

#### ✅ Do: Inject Context
```typescript
const userPromptWithContext = injectContextIntoPrompt('Parse this message', state.context);
const result = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptWithContext }  // Context included
  ]
});
```

#### ❌ Don't: Manually Merge State
```typescript
state.context = { ...state.context, ...newFields };  // Mutating state directly
```

#### ✅ Do: Return Partial Update
```typescript
return {
  context: newFields  // Reducer handles merging
};
```

### Testing Strategy

```bash
# 1. Start API
pnpm --filter api run dev

# 2. Test new session
curl -X POST http://localhost:4000/api/v1/chat/langgraph/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "[CALL_STARTED]"}'

# 3. Test conversation continuity
curl -X POST http://localhost:4000/api/v1/chat/langgraph/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "User input", "session_id": "from-previous-response"}'

# 4. Check session state
curl http://localhost:4000/api/v1/chat/langgraph/session/$SESSION_ID/status \
  -H "Authorization: Bearer $TOKEN"

# 5. Monitor logs
tail -f logs/api.log | grep -E "🎯|LangGraph|Error"
```

### Performance Optimization

1. **Checkpointer**: In-memory for development, PostgreSQL for production
2. **Skip Completed Steps**: Reduces unnecessary LLM calls
3. **JSON Mode**: Faster structured extraction than parsing text
4. **Temperature Tuning**: Lower for deterministic tasks, higher for creative responses
5. **Prompt Optimization**: Shorter prompts with clear instructions reduce token usage

### Security Considerations

1. **Auth Token**: Always pass through `_authToken` in state, never serialize to checkpointer
2. **PII Handling**: CustomerContext contains sensitive data—encrypt at rest in database
3. **Input Validation**: Sanitize user messages before LLM calls
4. **Rate Limiting**: Implement per-session to prevent abuse
5. **MCP Tool Access**: Validate auth token before every tool execution

---

## Files Structure

```
apps/api/src/modules/chat/orchestrator/langgraph/
├── langgraph-orchestrator.service.ts      # Main orchestrator (218 lines)
├── langgraph-state-graph.service.ts       # Graph construction & execution (745 lines)
├── graph-nodes.service.ts                 # All 14 node functions (950 lines)
├── prompts.config.ts                      # Centralized prompts & types (536 lines)
├── langgraph-orchestrator.routes.ts       # API endpoints (127 lines)
└── LANGGRAPH_IMPLEMENTATION.md            # This documentation
```

---

## Version History

- **v1.0.0** (2025-11-07): Initial production release with 14-step flow, MCP integration, dual persistence
- **v1.0.1** (2025-11-07): Fixed infinite loop bug (return END for wait states)

---

**Status**: ✅ Production-Ready
**Maintainer**: PMO Platform Team
**Last Review**: 2025-11-07
