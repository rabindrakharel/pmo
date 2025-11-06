# Multi-Agent LLM Orchestrator

**Stateful, multi-agent orchestration framework for robust LLM workflows**

---

## Overview

This module implements a production-ready **multi-agent orchestration framework** that enables small, low-token LLM models to handle complex, stateful workflows through structured coordination of specialized agents.

### Key Features

- ✅ **Stateful Workflow Management** - All context persisted in PostgreSQL
- ✅ **5 Specialized Agents** - Authenticator, Orchestrator, Worker, Evaluator, Critic
- ✅ **Declarative Intent Graphs** - Workflows defined as data, not code
- ✅ **MCP-First Architecture** - All tool calls via Model Context Protocol
- ✅ **Context Retention** - Prevents LLM memory loss through external state
- ✅ **Quality Control** - Multi-layer validation and boundary enforcement
- ✅ **Fully Auditable** - Complete logs of all agent actions

---

## Directory Structure

```
orchestrator/
├── agents/
│   ├── authenticator.agent.ts    # Auth validation
│   ├── worker.agent.ts            # Task execution via MCP
│   ├── evaluator.agent.ts         # Output validation
│   └── critic.agent.ts            # Quality control
├── intent-graphs/
│   ├── calendar-booking.graph.ts  # Example: booking workflow
│   └── index.ts                   # Intent registry
├── state/
│   └── state-manager.service.ts   # PostgreSQL persistence
├── types/
│   └── intent-graph.types.ts      # Type definitions
├── orchestrator.service.ts        # Main coordinator
├── orchestrator.routes.ts         # API endpoints
└── README.md                      # This file
```

---

## Quick Start

### 1. Import Database Schema

```bash
./tools/db-import.sh
```

This creates 4 tables:
- `orchestrator_session`
- `orchestrator_state`
- `orchestrator_agent_log`
- `orchestrator_summary`

### 2. Use Orchestrator API

```typescript
import { orchestratorService } from './orchestrator/orchestrator.service.js';

const result = await orchestratorService.processMessage({
  message: 'I need landscaping service',
  authToken: req.headers.authorization
});

console.log(result.response); // "Can I get your name and phone number?"
console.log(result.intent);   // "CalendarBooking"
console.log(result.currentNode); // "identify_customer"
```

### 3. Test via API

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to schedule a service"
  }'
```

---

## Architecture

### Agent Flow

```
User Message
    ↓
Authenticator (validates token, checks permissions)
    ↓
Orchestrator (detects intent, loads graph, coordinates agents)
    ↓
┌───────────────────────────────────────┐
│  For each node in intent graph:       │
│                                        │
│  1. Worker executes actions           │
│     - MCP tool calls                  │
│     - Data collection                 │
│     - Option presentation             │
│                                        │
│  2. Critic reviews output             │
│     - Quality check                   │
│     - Hallucination detection         │
│                                        │
│  3. Evaluator validates               │
│     - Required fields present         │
│     - Data format correct             │
│     - Business rules satisfied        │
│     - Determines next node            │
│                                        │
│  4. State Manager persists            │
│     - Session updates                 │
│     - State variables                 │
│     - Agent logs                      │
│                                        │
└───────────────────────────────────────┘
    ↓
Response to user
```

### State Management

All workflow state is externalized to PostgreSQL:

```typescript
// Session state
{
  current_intent: 'CalendarBooking',
  current_node: 'gather_booking_requirements',
  status: 'active'
}

// State variables (key-value)
{
  customer_id: 'uuid',
  customer_name: 'John Doe',
  service_category: 'Landscaping',
  desired_date: '2025-11-15'
}

// Agent logs (audit trail)
[
  {
    agent_role: 'worker',
    agent_action: 'mcp_call',
    mcp_tool_name: 'customer_create',
    success: true
  }
]
```

---

## Creating New Intents

### Step 1: Define Intent Graph

Create `intent-graphs/my-intent.graph.ts`:

```typescript
import type { IntentGraph } from '../types/intent-graph.types.js';

export const MyIntentGraph: IntentGraph = {
  name: 'MyIntent',
  description: 'Handle my custom workflow',
  version: 'v1.0',
  startNode: 'first_step',

  boundaries: {
    allowedTopics: ['my', 'topics'],
    forbiddenTopics: ['off', 'topic'],
    maxTurns: 20,
    canPause: true,
    canCancel: true
  },

  requiredPermissions: ['my:permission'],

  nodes: {
    first_step: {
      id: 'first_step',
      name: 'First Step',
      description: 'Collect initial data',
      agentRoles: ['worker'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'user_input',
              type: 'string',
              required: true,
              prompt: 'What information do you need?'
            }
          ]
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['user_input'],
          errorMessage: 'User input is required',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'second_step',
          isDefault: true
        }
      ]
    },

    second_step: {
      // ... define next node
    }
  }
};
```

### Step 2: Register Intent

Edit `intent-graphs/index.ts`:

```typescript
import { MyIntentGraph } from './my-intent.graph.js';

export const IntentGraphRegistry: Record<string, IntentGraph> = {
  CalendarBooking: CalendarBookingGraph,
  MyIntent: MyIntentGraph  // Add here
};
```

### Step 3: Update Intent Detection

Edit `orchestrator.service.ts`:

```typescript
private async detectIntent(message: string, state: Record<string, any>): Promise<IntentDetectionResult> {
  const lowerMessage = message.toLowerCase();

  // Add detection logic
  if (lowerMessage.includes('my') && lowerMessage.includes('intent')) {
    return {
      intent: 'MyIntent',
      confidence: 0.9
    };
  }

  // ... existing logic
}
```

---

## Agent Reference

### Authenticator Agent

**Purpose:** Authentication and authorization

**Methods:**
- `authenticate(sessionId, authToken, requiredPermissions)` → validates and returns auth context

**Example:**
```typescript
const result = await authenticatorAgent.authenticate({
  sessionId: 'abc-123',
  authToken: 'Bearer xyz',
  requiredPermissions: ['customer:write']
});

if (!result.success) {
  console.log(result.error); // 'Invalid token'
}
```

### Worker Agent

**Purpose:** Execute actions defined in intent graph

**Methods:**
- `executeAction(sessionId, nodeContext, action, state, authToken)` → performs action and returns result

**Action Types:**
- `mcp_call` - Call MCP tool
- `collect_data` - Extract data from user message
- `present_options` - Show choices to user
- `confirm` - Get explicit confirmation
- `summarize` - Generate natural language summary

**Example:**
```typescript
const result = await workerAgent.executeAction({
  sessionId: 'abc-123',
  nodeContext: 'create_customer',
  action: {
    type: 'mcp_call',
    mcpTool: 'customer_create',
    inputMapping: {
      body_name: 'customer_name',
      body_phone: 'customer_phone'
    },
    outputMapping: {
      customer_id: 'id'
    }
  },
  state: { customer_name: 'John', customer_phone: '1234567890' },
  authToken: 'Bearer xyz'
});
```

### Evaluator Agent

**Purpose:** Validate outputs and determine next node

**Methods:**
- `evaluateNode(sessionId, node, state, workerResult)` → validates and returns next node

**Validation Types:**
- `required_fields` - Check for missing data
- `data_format` - Regex/type validation
- `business_rule` - Custom logic
- `mcp_success` - Verify tool call succeeded

**Example:**
```typescript
const result = await evaluatorAgent.evaluateNode({
  sessionId: 'abc-123',
  node: graphNode,
  state: { customer_id: 'uuid', customer_name: 'John' },
  workerResult: { success: true }
});

console.log(result.nextNode); // 'gather_booking_requirements'
```

### Critic Agent

**Purpose:** Quality control and boundary enforcement

**Methods:**
- `reviewConversation(sessionId, graph, userMessage, state)` → checks for off-topic drift
- `reviewWorkerOutput(sessionId, graph, nodeContext, workerResult, state)` → quality check
- `checkBoundaryRules(sessionId, graph, currentNode, state)` → validates custom rules

**Example:**
```typescript
const result = await criticAgent.reviewConversation({
  sessionId: 'abc-123',
  graph: CalendarBookingGraph,
  userMessage: 'What\'s the weather?',
  state: {}
});

if (!result.success) {
  console.log(result.error); // 'off_topic'
  console.log(result.naturalResponse); // 'I\'m specifically here to help with bookings...'
}
```

---

## State Manager Reference

### Session Management

```typescript
// Create session
const session = await stateManager.createSession({
  chat_session_id: 'chat-uuid',
  user_id: 'user-uuid',
  initial_intent: 'CalendarBooking'
});

// Get session
const session = await stateManager.getSession(sessionId);

// Update session
await stateManager.updateSession(sessionId, {
  current_node: 'next_node',
  status: 'active'
});

// Complete session
await stateManager.completeSession(sessionId, 'completed');
```

### State Variables

```typescript
// Set state
await stateManager.setState(sessionId, 'customer_name', 'John Doe', {
  source: 'worker',
  node_context: 'create_customer',
  validated: true
});

// Get state
const value = await stateManager.getState(sessionId, 'customer_name');

// Get all state
const allState = await stateManager.getAllState(sessionId);
```

### Agent Logging

```typescript
// Log agent action
await stateManager.logAgentAction({
  session_id: sessionId,
  agent_role: 'worker',
  agent_action: 'mcp_call',
  node_context: 'create_customer',
  mcp_tool_name: 'customer_create',
  mcp_tool_args: { name: 'John' },
  mcp_tool_result: { id: 'uuid' },
  mcp_success: true,
  success: true,
  natural_response: 'Customer created successfully',
  duration_ms: 250
});

// Get logs
const logs = await stateManager.getAgentLogs(sessionId, {
  agent_role: 'worker',
  limit: 50
});
```

### Conversation Summaries

```typescript
// Save summary
await stateManager.saveSummary({
  session_id: sessionId,
  summary_type: 'full',
  summary_text: 'Customer John Doe booked landscaping service for Nov 15',
  up_to_node: 'confirm_and_summarize',
  message_count: 8
});

// Get latest summary
const summary = await stateManager.getLatestSummary(sessionId);
```

---

## API Endpoints

### POST /api/v1/chat/orchestrator/message

Process message through orchestrator.

**Request:**
```json
{
  "session_id": "uuid (optional)",
  "message": "string",
  "chat_session_id": "uuid (optional)",
  "user_id": "uuid (optional)",
  "tenant_id": "uuid (optional)"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "response": "string",
  "intent": "string",
  "currentNode": "string",
  "requiresUserInput": boolean,
  "completed": boolean,
  "agentLogs": []
}
```

### GET /api/v1/chat/orchestrator/session/:sessionId/status

Get session status.

### GET /api/v1/chat/orchestrator/intents

List available intents.

### GET /api/v1/chat/orchestrator/intent/:intentName/graph

Get intent graph definition.

---

## Testing

### Unit Tests

```bash
# Test individual agents
pnpm test orchestrator/agents

# Test state manager
pnpm test orchestrator/state

# Test intent graphs
pnpm test orchestrator/intent-graphs
```

### Integration Tests

```bash
# Test complete workflow
pnpm test orchestrator/integration
```

### Manual Testing

See `docs/orchestrator/QUICK_START_GUIDE.md` for curl examples.

---

## Performance

### Metrics

- **Average latency:** 500ms per message (including MCP calls)
- **Token usage:** 500-1500 tokens per message (with small models)
- **Database queries:** 5-10 per message
- **MCP calls:** 1-3 per message

### Optimization

1. Use connection pooling (already configured)
2. Generate summaries every 10 messages
3. Limit agent logs to 30 days retention
4. Cache intent graphs in memory (already done)

---

## Security

### Authentication

- JWT validation via `AuthenticatorAgent`
- Permission checks before intent execution
- All MCP calls use authenticated tokens

### Authorization

- RBAC enforced at MCP layer
- Tenant-based data isolation
- Admin-only intents require explicit permissions

### Audit Trail

- All agent actions logged
- MCP tool calls recorded with args/results
- Session state changes tracked

---

## Documentation

- **Full Guide:** `/docs/orchestrator/MULTI_AGENT_ORCHESTRATOR.md`
- **Quick Start:** `/docs/orchestrator/QUICK_START_GUIDE.md`
- **This File:** Architecture and API reference

---

## Support

**Issues:** Report bugs or feature requests via GitHub Issues

**Questions:** Contact the PMO platform team

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-11-06
