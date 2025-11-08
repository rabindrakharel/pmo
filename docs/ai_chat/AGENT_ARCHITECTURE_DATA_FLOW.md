# Agent Architecture & Data Flow

**Date:** 2025-11-08
**Version:** 2.0
**Status:** ✅ Production

---

## 🎯 Architecture Overview

The AI chat system uses a **robust orchestrator** pattern with specialized agents:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                           │
│  Coordinates: Navigator + WorkerMCP + WorkerReply              │
└─────────────────────────────────────────────────────────────────┘
                              ▼
        ┌─────────────────────────────────────────────┐
        │         DAG Configuration (agent_config.json) │
        │  • 18 Nodes with metadata                   │
        │  • Branching conditions                     │
        │  • Agent profiles                           │
        │  • Global context schema                    │
        └─────────────────────────────────────────────┘
                              ▼
    ┌──────────────┬──────────────┬──────────────┐
    │   Navigator  │  WorkerMCP   │ WorkerReply  │
    │   Agent      │    Agent     │   Agent      │
    └──────────────┴──────────────┴──────────────┘
```

---

## 📊 Agent Responsibilities

### 1. Navigator Agent (Routing Brain)

**Purpose:** Decides which node to execute next based on context

**Inputs:**
- **Node state metadata** (for child nodes only):
  - `node_name` - Identifier
  - `role` - What the node is
  - `goal` - What the node does (plan)
- **Branching conditions** (from current node):
  - `condition` - When to choose this path
  - `child_node` - Which node to go to
- **Context data** (essential fields only):
  - Mandatory fields (customers_main_ask, customer_phone_number)
  - Active flags (1=done, 0=pending)
  - Last 3 conversation summaries
  - Actively tracked fields

**Outputs:**
```typescript
{
  nextNode: string,                    // Which node to execute next
  nextCourseOfAction: string,          // What happens next (1 sentence)
  reason: string,                      // Why this node was chosen
  matchedCondition: string | null,     // Which branching condition matched
  validationStatus: {
    onTrack: boolean,                  // Is conversation on track?
    reason: string,                    // Why on/off track
    flagResets: Record<string, number> // Flags to reset if off-track
  }
}
```

**Key Optimizations:**
- ✅ Only passes metadata for available child nodes (2-4), not all 18 nodes
- ✅ Removed `context_update` from metadata (200-600 tokens saved)
- ✅ Only passes last 3 conversation summaries
- ✅ Only passes essential context fields (excludes empty/default values)

**File:** `apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts`

---

### 2. Worker Reply Agent (Customer Response Generator)

**Purpose:** Generate natural customer-facing responses (1-2 sentences)

**Inputs:**
- **Node state metadata** (current node):
  - `role` - Node's role/persona
  - `goal` - Node's objective
  - `example_tone_of_reply` - Tone/style examples
- **Context data** (relevant parts only):
  - Last 5 conversation exchanges
  - Flags (completion tracking)
  - Mandatory fields (customers_main_ask, customer_phone_number)
  - Actively tracked fields (customer_name, service_catalog, task_id, etc.)
- **User message** (if first iteration)

**Outputs:**
```typescript
{
  response: string  // Natural customer-facing response (1-2 sentences)
}
```

**Key Optimizations:**
- ✅ Only passes role, goal, example_tone_of_reply (not full prompt templates)
- ✅ Only last 5 conversation exchanges (not all 255!)
- ✅ Only actively tracked context fields (excludes empty/default values)
- ✅ Reviews recent_conversation to avoid repetition

**File:** `apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts`

---

### 3. Worker MCP Agent (Data Gatherer & Context Builder)

**Purpose:** Execute MCP tools and extract information from conversation

**Inputs:**
- **Node state metadata** (current node):
  - `role` - Node's role/persona
  - `goal` - Node's objective
  - `example_tone_of_reply` - Tone/style examples
- **Context data** (relevant parts only):
  - Flags (completion tracking)
  - Mandatory fields (customers_main_ask, customer_phone_number)
  - Actively tracked fields (customer_id, task_id, service_catalog, etc.)
- **Available MCP tools** (for MCP nodes):
  - Tool name, description, parameters
- **Conversation history** (for extraction nodes):
  - Last 10 exchanges (for extraction)

**Outputs:**
```typescript
{
  statusMessage: string,           // Optional brief status to customer
  contextUpdates: Partial<DAGContext>,  // Fields to update in context
  mcpExecuted: boolean,            // Whether MCP tool was called
  mcpResults?: any                 // Raw MCP tool results
}
```

**Node Types:**
1. **MCP Tool Nodes** (e.g., `use_mcp_to_get_info`)
   - Decides which MCP tool to call
   - Executes tool via function calling
   - Maps results to context fields

2. **Extraction Nodes** (e.g., `Extract_Customer_Issue`)
   - Analyzes conversation history
   - Extracts structured data (customers_main_ask, customer_name, etc.)
   - Returns context updates (no MCP calls)

**Key Optimizations:**
- ✅ Only passes role, goal, example_tone_of_reply
- ✅ Only actively tracked context fields (excludes empty/default values)
- ✅ Last 10 exchanges for extraction (not all conversation history)
- ✅ MCP tool list only for MCP nodes

**File:** `apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts`

---

## 🔄 Complete Data Flow

### Initialization (New Session)

```typescript
1. User sends first message: "Hello, I need help with my lawn"

2. Orchestrator creates new session:
   - sessionId: uuid-123
   - Initialize context from DAG config (global_context_schema)
   - Set entry node: GREET_CUSTOMER

3. Context initialized:
   {
     agent_session_id: "uuid-123",
     who_are_you: "You are a polite customer service agent...",
     customers_main_ask: "",
     customer_phone_number: "",
     flags: {},
     summary_of_conversation_on_each_step_until_now: [],
     node_traversal_path: []
   }
```

### Conversation Loop (Each Turn)

```
┌─────────────────────────────────────────────────────────────┐
│ ITERATION 1: User Message Received                         │
└─────────────────────────────────────────────────────────────┘

STEP 1: WORKER AGENT EXECUTION
─────────────────────────────────────────────────────────────
Current Node: GREET_CUSTOMER
Node Type: worker_reply_agent

Orchestrator:
  ├─> Get node config from DAG: GREET_CUSTOMER
  ├─> Check agent_profile_type: "worker_reply_agent"
  └─> Call WorkerReplyAgent.executeNode()

WorkerReplyAgent:
  ├─> Receives:
  │   ├─ nodeName: "GREET_CUSTOMER"
  │   ├─ state.context: { ... }  (incrementally built context)
  │   └─ userMessage: "Hello, I need help with my lawn"
  │
  ├─> Builds system prompt from node metadata:
  │   ├─ role: "a welcoming customer service representative"
  │   ├─ goal: "Greet the customer warmly..."
  │   ├─ example_tone_of_reply: "You are a polite customer service agent..."
  │   └─ active context: { recent_conversation: [], flags: {}, ... }
  │
  ├─> Calls LLM (GPT-4)
  │
  └─> Returns:
      └─ response: "Hello! I understand you need help with your lawn. Let me assist you with that."

Orchestrator:
  ├─> Adds assistant message to state.messages
  ├─> Appends to conversation summary:
  │   summary_of_conversation_on_each_step_until_now: [
  │     { customer: "Hello, I need help with my lawn",
  │       agent: "Hello! I understand you need help with your lawn..." }
  │   ]
  └─> Writes context file: context_uuid-123.json

STEP 2: NAVIGATOR DECISION
─────────────────────────────────────────────────────────────
Navigator:
  ├─> Receives:
  │   ├─ state.currentNode: "GREET_CUSTOMER"
  │   ├─ state.context: { summary_of_conversation_on_each_step_until_now: [...], flags: {}, ... }
  │   └─ state.messages: [ { role: "user", content: "..." }, { role: "assistant", content: "..." } ]
  │
  ├─> Gets current node's branching conditions from DAG:
  │   [
  │     { condition: "if customer stated their issue in first message",
  │       child_node: "Extract_Customer_Issue" },
  │     { condition: "if customer just greeted (no issue mentioned)",
  │       child_node: "ASK_CUSTOMER_ABOUT_THEIR_NEED" }
  │   ]
  │
  ├─> Gets child node metadata (OPTIMIZED):
  │   [
  │     { node_name: "Extract_Customer_Issue",
  │       role: "an information extraction specialist",
  │       goal: "Extract and structure the customer's main issue..." },
  │     { node_name: "ASK_CUSTOMER_ABOUT_THEIR_NEED",
  │       role: "a helpful customer service agent",
  │       goal: "Elicit the customer's primary need..." }
  │   ]
  │
  ├─> Builds prompt:
  │   ├─ Available child nodes (metadata above)
  │   ├─ Branching conditions
  │   ├─ Essential context:
  │   │   ├─ flags: {}
  │   │   ├─ customers_main_ask: "(not set)"
  │   │   ├─ customer_phone_number: "(not set)"
  │   │   └─ recent_conversation: [last 3 exchanges]
  │   └─ Last user message: "Hello, I need help with my lawn"
  │
  ├─> Calls LLM (GPT-4, temperature=0.1, JSON mode)
  │
  └─> Returns decision:
      {
        validationStatus: { onTrack: true, reason: "Customer stated issue" },
        nextNode: "Extract_Customer_Issue",
        nextCourseOfAction: "Extract customer's lawn issue from message",
        reason: "Customer mentioned lawn problem in first message",
        matchedCondition: "if customer stated their issue in first message"
      }

Orchestrator:
  ├─> Logs navigator decision
  ├─> Updates context:
  │   ├─ next_node_to_go_to: "Extract_Customer_Issue"
  │   └─ next_course_of_action: "Extract customer's lawn issue from message"
  └─> Writes context file: context_uuid-123.json (navigation step)

STEP 3: STATE TRANSITION
─────────────────────────────────────────────────────────────
Orchestrator:
  ├─> FORCE transition: GREET_CUSTOMER → Extract_Customer_Issue
  ├─> Update state.currentNode: "Extract_Customer_Issue"
  ├─> Append to node_traversal_path: ["GREET_CUSTOMER", "Extract_Customer_Issue"]
  ├─> Write context file
  └─> BREAK (single-turn mode - wait for next user message)

┌─────────────────────────────────────────────────────────────┐
│ END OF ITERATION 1                                          │
└─────────────────────────────────────────────────────────────┘

Returns to frontend:
  {
    sessionId: "uuid-123",
    response: "Hello! I understand you need help with your lawn. Let me assist you with that.",
    currentNode: "Extract_Customer_Issue",
    requiresUserInput: true,
    conversationEnded: false
  }
```

### Next Turn (User Responds)

```
┌─────────────────────────────────────────────────────────────┐
│ ITERATION 2: User Message Received                         │
└─────────────────────────────────────────────────────────────┘

User: "Yes, my lawn is brown and patchy"

STEP 1: WORKER AGENT EXECUTION
─────────────────────────────────────────────────────────────
Current Node: Extract_Customer_Issue
Node Type: worker_mcp_agent (extraction node)

Orchestrator:
  ├─> Get node config: Extract_Customer_Issue
  ├─> Check agent_profile_type: "worker_mcp_agent"
  └─> Call WorkerMCPAgent.executeNode()

WorkerMCPAgent:
  ├─> Detects extraction node (Extract_Customer_Issue)
  ├─> Receives:
  │   ├─ nodeName: "Extract_Customer_Issue"
  │   └─ state (with conversation history)
  │
  ├─> Builds extraction prompt:
  │   ├─ role: "an information extraction specialist"
  │   ├─ goal: "Extract and structure the customer's main issue..."
  │   ├─ example_tone: extraction rules
  │   └─ conversation history (last 10 exchanges):
  │       1. CUSTOMER: Hello, I need help with my lawn
  │          AGENT: Hello! I understand you need help with your lawn...
  │       2. CUSTOMER: Yes, my lawn is brown and patchy
  │
  ├─> Calls LLM (GPT-4, temperature=0.1, JSON mode)
  │
  └─> Returns:
      {
        statusMessage: "",  // No customer response for extraction nodes
        contextUpdates: {
          customers_main_ask: "Lawn care - brown and patchy grass issue"
        },
        mcpExecuted: true,
        mcpResults: { customers_main_ask: "Lawn care - brown and patchy grass issue" }
      }

Orchestrator:
  ├─> Applies context updates (NON-DESTRUCTIVE MERGE):
  │   ├─ customers_main_ask: "Lawn care - brown and patchy grass issue" ✅ NEW
  │   └─ flags: { extract_issue_flag: 1 } ✅ SET
  │
  ├─> Appends to conversation summary (only if user message + response):
  │   (Skip for extraction nodes - no customer-facing response)
  │
  └─> Writes context file

STEP 2: NAVIGATOR DECISION
─────────────────────────────────────────────────────────────
Navigator:
  ├─> Receives updated context:
  │   ├─ customers_main_ask: "Lawn care - brown and patchy grass issue" ✅
  │   ├─ flags: { extract_issue_flag: 1 }
  │   └─ customer_phone_number: "(not set)"
  │
  ├─> Gets branching conditions for Extract_Customer_Issue:
  │   [
  │     { condition: "if customers_main_ask successfully extracted",
  │       child_node: "Identify_Issue" },
  │     { condition: "if extraction fails or unclear",
  │       child_node: "ASK_CUSTOMER_ABOUT_THEIR_NEED" }
  │   ]
  │
  ├─> Evaluates conditions:
  │   ✅ customers_main_ask is set → MATCH: "if customers_main_ask successfully extracted"
  │
  └─> Returns decision:
      {
        nextNode: "Identify_Issue",
        matchedCondition: "if customers_main_ask successfully extracted"
      }

STEP 3: STATE TRANSITION
─────────────────────────────────────────────────────────────
Orchestrator:
  ├─> Transition: Extract_Customer_Issue → Identify_Issue
  └─> Continue loop... (next iteration)
```

---

## 📦 Context Data Management

### Incremental Building Pattern

**Context is built incrementally across nodes:**

```typescript
// Initial state (GREET_CUSTOMER):
{
  customers_main_ask: "",
  customer_phone_number: "",
  customer_name: "",
  flags: {}
}

// After Extract_Customer_Issue:
{
  customers_main_ask: "Lawn care - brown and patchy grass issue",  // ✅ Added
  customer_phone_number: "",
  customer_name: "",
  flags: { extract_issue_flag: 1 }  // ✅ Added
}

// After ASK_FOR_PHONE_NUMBER (user provides phone):
{
  customers_main_ask: "Lawn care - brown and patchy grass issue",  // ✅ Kept
  customer_phone_number: "555-1234",  // ✅ Added
  customer_name: "",
  flags: { extract_issue_flag: 1, data_phone_flag: 1 }  // ✅ Added
}

// After use_mcp_to_get_info (MCP tool fetches customer):
{
  customers_main_ask: "Lawn care - brown and patchy grass issue",  // ✅ Kept
  customer_phone_number: "555-1234",  // ✅ Kept
  customer_name: "John Smith",  // ✅ Added from MCP
  customer_id: "uuid-customer-123",  // ✅ Added from MCP
  flags: { extract_issue_flag: 1, data_phone_flag: 1 }  // ✅ Kept
}
```

### Non-Destructive Merge Rules

**File:** `apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts` (lines 162-191)

```typescript
// ✅ ARRAYS: APPEND (never replace)
summary_of_conversation_on_each_step_until_now: [...existing, ...newItems]
node_traversal_path: [...existing, ...newNodes]

// ✅ SCALAR FIELDS: UPDATE only if new value is meaningful
if (value !== undefined && value !== null && value !== '') {
  merged[key] = value;
}

// ❌ NEVER remove existing data
// ❌ NEVER replace arrays
```

### Agent-Specific Context Filtering

**Each agent accesses only relevant parts:**

```typescript
// Navigator Agent:
const essentialContext = {
  flags: context.flags,
  customers_main_ask: context.customers_main_ask || '(not set)',
  customer_phone_number: context.customer_phone_number || '(not set)',
  // + actively tracked fields only
};

// Worker Reply Agent:
const activeContext = {
  recent_conversation: recentConversation.slice(-5),  // Last 5 only
  flags: context.flags,
  customers_main_ask: context.customers_main_ask,
  customer_phone_number: context.customer_phone_number,
  customer_name: context.customer_name,
  // + non-empty tracking fields only
};

// Worker MCP Agent:
const activeContext = {
  flags: context.flags,
  customers_main_ask: context.customers_main_ask,
  customer_phone_number: context.customer_phone_number,
  customer_id: context.customer_id,
  task_id: context.task_id,
  // + non-empty tracking fields only
};
```

**Key Principle:** Empty/default values are excluded to save tokens.

---

## 🔍 Node State Metadata Usage

### DAG Configuration Structure

**File:** `apps/api/src/modules/chat/orchestrator/agent_config.json`

```json
{
  "nodes": [
    {
      "node_name": "GREET_CUSTOMER",
      "node_action": "reply",
      "agent_profile_type": "worker_reply_agent",

      // Node State Metadata (business operation state):
      "role": "a welcoming customer service representative",
      "node_goal": "Greet the customer warmly with a conversational question...",
      "example_tone_of_reply": "You are a polite customer service agent...",

      // Routing metadata:
      "default_next_node": "ASK_CUSTOMER_ABOUT_THEIR_NEED",
      "branching_conditions": [
        {
          "condition": "if customer stated their issue in first message",
          "child_node": "Extract_Customer_Issue"
        }
      ],

      // Context building:
      "context_update": "Initialize context with all required fields. Extract customers_main_ask if present...",
      "expected_context_fields": ["agent_session_id", "who_are_you", "summary_of_conversation_on_each_step_until_now", "node_traversal_path"]
    }
  ]
}
```

### How Each Agent Uses Node Metadata

| Agent | Uses | Doesn't Use |
|-------|------|-------------|
| **Navigator** | `node_name`, `role`, `goal` (for child nodes), `branching_conditions`, `default_next_node` | `prompt`, `example_tone_of_reply`, `context_update`, `expected_context_fields` |
| **Worker Reply** | `role`, `goal`, `example_tone_of_reply` | `branching_conditions`, `default_next_node`, `context_update`, `expected_context_fields` |
| **Worker MCP** | `role`, `goal`, `example_tone_of_reply`, `expected_context_fields` (extraction) | `branching_conditions`, `default_next_node` |

**Optimization:** Each agent receives ONLY the metadata it needs, not the entire node config.

---

## 📈 Token Usage Per Agent

### Navigator Agent (per call):
- Child node metadata: ~400-600 tokens (2-4 nodes × ~150 tokens each)
- Branching conditions: ~100-200 tokens
- Essential context: ~200-300 tokens
- System prompt: ~300-400 tokens
- **Total: ~1000-1500 tokens per navigation call**

### Worker Reply Agent (per call):
- Node metadata (role, goal, example): ~200-400 tokens
- Active context: ~200-400 tokens
- Recent conversation (last 5): ~300-500 tokens
- System prompt: ~200-300 tokens
- **Total: ~900-1600 tokens per reply call**

### Worker MCP Agent (per call):
- Node metadata (role, goal, example): ~200-400 tokens
- Active context: ~200-400 tokens
- MCP tool list: ~100-200 tokens
- System prompt: ~200-300 tokens
- **Total: ~700-1300 tokens per MCP call**

**Per Conversation (avg 18 nodes, 15 user messages):**
- Navigator calls: ~3-5 × 1000-1500 = ~3000-7500 tokens
- Worker Reply calls: ~10-15 × 900-1600 = ~9000-24000 tokens
- Worker MCP calls: ~3-5 × 700-1300 = ~2100-6500 tokens
- **Total: ~14000-38000 tokens per conversation**

---

## ✅ Architecture Verification Checklist

- [x] Orchestrator coordinates all agents
- [x] Navigator receives: node metadata + branching conditions + context data
- [x] WorkerMCP receives: node metadata (role, goal, example_tone) + context data (relevant parts)
- [x] WorkerReply receives: node metadata (role, goal, example_tone) + context data (relevant parts)
- [x] Context data is incrementally built across nodes
- [x] Each agent accesses only relevant context fields (actively tracked)
- [x] Non-destructive merge pattern for context updates
- [x] Navigator only receives metadata for available child nodes (not all 18)
- [x] Navigator removed `context_update` from metadata (token optimization)
- [x] Worker agents filter to last N conversation exchanges
- [x] Empty/default values excluded from context

---

## 🔗 Related Files

### Core Agent Files:
- **Orchestrator:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`
- **Navigator:** `apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts`
- **Worker Reply:** `apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts`
- **Worker MCP:** `apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts`

### Configuration & Context:
- **DAG Config:** `apps/api/src/modules/chat/orchestrator/agent_config.json`
- **Context Manager:** `apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts`
- **DAG Loader:** `apps/api/src/modules/chat/orchestrator/agents/dag-loader.service.ts`

### Support Services:
- **OpenAI Service:** `apps/api/src/modules/chat/orchestrator/services/openai.service.ts`
- **MCP Adapter:** `apps/api/src/modules/chat/mcp-adapter.service.ts`
- **State Manager:** `apps/api/src/modules/chat/orchestrator/state/state-manager.service.ts`

---

## 📝 Key Takeaways

1. **Robust Orchestrator** - Coordinates all agents, manages state transitions, writes context files
2. **Navigator as Routing Brain** - Evaluates branching conditions, chooses next node, validates conversation direction
3. **Specialized Worker Agents** - Reply for customer responses, MCP for data gathering and extraction
4. **Node State Metadata** - Defines business operation state (role, goal, example_tone)
5. **Incremental Context Building** - Each node contributes fields, non-destructive merge
6. **Selective Data Access** - Each agent receives only relevant context parts (actively tracked fields)
7. **Token Optimization** - Metadata filtering, conversation history limits, empty value exclusion

---

**Last Updated:** 2025-11-08
**Architecture Version:** 2.0 (Optimized)
**Status:** ✅ Production-ready
