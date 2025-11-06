# Multi-Agent LLM Orchestrator Framework

> **📌 DOCUMENTATION UPDATED:** This document has been superseded by the consolidated technical reference.
>
> **Please refer to:** [`README.md`](./README.md) for the complete, up-to-date orchestrator documentation.
>
> This file is kept for historical reference only.

**Version:** 1.0.0 | **Status:** Production Ready | **Updated:** 2025-11-06

---

## 1. Overview

### Purpose

The Multi-Agent LLM Orchestrator is a **stateful, multi-agent orchestration framework** that enables small, low-token LLM models to achieve robust, reliable behavior through structured workflow management and specialized agent roles.

### Key Problems Solved

1. **Context Loss** - External state management prevents LLM memory degradation
2. **Topic Drift** - Intent graphs and Critic agent enforce conversation boundaries
3. **Hallucinations** - Quality control through Evaluator and Critic agents
4. **Incomplete Tasks** - Structured workflow ensures all required steps are completed
5. **Scalability** - Small models can handle complex workflows with proper orchestration

### Architecture Principles

- **Stateful by Design** - All context persisted in PostgreSQL via Drizzle ORM
- **Agent Specialization** - Each agent has a single, well-defined responsibility
- **Declarative Workflows** - Intent graphs define behavior, not code
- **MCP-First** - All tool calls go through Model Context Protocol servers
- **Auditable** - Complete agent action logs for debugging and compliance

---

## 2. System Architecture

### Block Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER MESSAGE                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AUTHENTICATOR AGENT                                         │
│  - Validates JWT token                                       │
│  - Checks permissions                                        │
│  - Sets up auth context                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR SERVICE                                        │
│  - Detects/retrieves intent                                  │
│  - Loads intent graph                                        │
│  - Coordinates agent execution                               │
│  - Manages workflow state                                    │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────────┐  ┌───────────────────┐
│   WORKER    │  │   EVALUATOR     │  │     CRITIC        │
│   AGENT     │  │     AGENT       │  │     AGENT         │
│             │  │                 │  │                   │
│ - Executes  │  │ - Validates     │  │ - Checks quality  │
│   actions   │  │   outputs       │  │ - Enforces        │
│ - MCP calls │  │ - Determines    │  │   boundaries      │
│ - Collects  │  │   next node     │  │ - Detects drift   │
│   data      │  │ - Marks state   │  │ - Reviews outputs │
│             │  │   as validated  │  │                   │
└─────┬───────┘  └────────┬────────┘  └────────┬──────────┘
      │                   │                     │
      └───────────────────┴─────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STATE MANAGER                                               │
│  - PostgreSQL persistence (4 tables)                         │
│  - Session state, variables, summaries, logs                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP SERVER                                                  │
│  - 126+ PMO API endpoints                                    │
│  - Customer, Task, Employee, Booking operations              │
└─────────────────────────────────────────────────────────────┘
```

### Agent Roles

#### 1. Authenticator Agent
**Responsibility:** Authentication and authorization

**Actions:**
- Validates JWT tokens
- Extracts user context (user_id, tenant_id, roles)
- Checks required permissions for intent
- Returns natural-language auth errors

**Output:**
```typescript
{
  success: boolean,
  agentRole: 'authenticator',
  action: 'authenticate',
  naturalResponse: string,
  stateUpdates: {
    is_authenticated: boolean,
    user_id?: string,
    user_name?: string
  }
}
```

#### 2. Orchestrator Service
**Responsibility:** Workflow coordination

**Actions:**
- Detects user intent (CalendarBooking, ComplaintHandling, etc.)
- Loads appropriate intent graph
- Executes workflow from current node
- Coordinates Worker, Evaluator, Critic
- Manages state persistence
- Generates conversation summaries

**Key Methods:**
- `processMessage()` - Main entry point
- `executeWorkflow()` - Node-by-node execution
- `detectIntent()` - Intent classification

#### 3. Worker Agent
**Responsibility:** Task execution

**Actions:**
- **mcp_call** - Execute MCP tool with auth token
- **collect_data** - Extract data from user messages
- **present_options** - Show choices to user
- **confirm** - Get explicit user confirmation
- **summarize** - Generate natural language summary

**MCP Tool Call Flow:**
1. Map input parameters from state
2. Execute `executeMCPTool(name, args, token)`
3. Map output to state variables
4. Persist state updates
5. Return natural response

#### 4. Evaluator Agent
**Responsibility:** Validation and progression

**Actions:**
- Validates required fields are present
- Checks data formats (regex, types)
- Evaluates business rules (dates, constraints)
- Verifies MCP tool success
- Determines next node via transition conditions
- Marks validated fields in state

**Validation Types:**
- `required_fields` - Check for missing data
- `data_format` - Regex/type validation
- `business_rule` - Custom logic (e.g., date >= today)
- `mcp_success` - Verify tool call succeeded

#### 5. Critic Agent
**Responsibility:** Quality control and boundaries

**Actions:**
- Detects off-topic drift (forbidden topics)
- Enforces conversation turn limits
- Reviews worker outputs for hallucinations
- Checks for data inconsistencies
- Validates custom boundary rules

**Quality Checks:**
- Hallucination detection (claimed success but no data)
- Inconsistency detection (contradictory state updates)
- Missing critical info (empty responses)
- Boundary rule violations

---

## 3. Intent Graphs (Declarative Workflows)

### Intent Graph Structure

```typescript
interface IntentGraph {
  name: string;              // e.g., 'CalendarBooking'
  description: string;
  version: string;
  startNode: string;         // Entry point
  nodes: Record<string, GraphNode>;
  boundaries: GraphBoundaries;
  requiredPermissions?: string[];
}
```

### Graph Node Structure

```typescript
interface GraphNode {
  id: string;
  name: string;
  description: string;
  agentRoles: AgentRole[];   // Which agents handle this
  requiredState?: string[];  // Prerequisites
  producesState?: string[];  // Outputs
  actions: NodeAction[];     // What to do
  validations?: NodeValidation[];
  transitions: NodeTransition[];
  requiresUserConfirmation?: boolean;
  responseTemplates?: ResponseTemplate[];
}
```

### Example: CalendarBooking Intent Graph

**Nodes:**

1. **identify_customer** - Search for customer by phone/email
2. **welcome_existing** - Greet returning customer
3. **create_customer** - Create new customer record
4. **gather_booking_requirements** - Collect service, date, description
5. **find_available_slots** - Query employee availability
6. **propose_options** - Present time slot choices
7. **create_booking** - Create task and link to customer
8. **confirm_and_summarize** - Final confirmation

**Workflow Example:**

```
User: "I need landscaping service"
  ↓ Orchestrator detects intent: CalendarBooking
  ↓ Starts at: identify_customer

[identify_customer]
  Worker: collect_data (name, phone)
  Worker: mcp_call(customer_list, {phone})
  Evaluator: validate required_fields
  Transition: → create_customer (if not found)

[create_customer]
  Worker: collect_data (address, city, postal_code)
  Worker: mcp_call(customer_create, {name, phone, address})
  Evaluator: validate mcp_success
  Transition: → gather_booking_requirements

[gather_booking_requirements]
  Worker: collect_data (service_category, desired_date, job_description)
  Evaluator: validate business_rule (date >= today)
  Transition: → find_available_slots

[find_available_slots]
  Worker: mcp_call(employee_list, {department: service_category})
  Evaluator: check available_employees.length > 0
  Transition: → propose_options (if available)

[propose_options]
  Worker: present_options (time slots)
  Worker: collect_data (selected_time)
  Critic: check user_confirmed_booking
  Transition: → create_booking

[create_booking]
  Worker: mcp_call(task_create, {name, descr, category})
  Worker: mcp_call(linkage_create, {customer_id, task_id})
  Evaluator: validate mcp_success
  Transition: → confirm_and_summarize

[confirm_and_summarize]
  Worker: summarize (final details)
  Orchestrator: completeSession()
```

---

## 4. Database Schema

### Table: `orchestrator_session`

Tracks orchestration sessions with workflow state.

```sql
CREATE TABLE app.orchestrator_session (
  id uuid PRIMARY KEY,
  session_number varchar(50) UNIQUE,
  chat_session_id uuid,
  user_id uuid,
  tenant_id uuid,
  auth_metadata jsonb,

  -- Workflow state
  current_intent varchar(100),
  current_node varchar(100),
  intent_graph_version varchar(20),
  status varchar(50),  -- 'active', 'paused', 'completed', 'failed'

  -- Context
  session_context jsonb,
  conversation_summary text,

  -- Metrics
  total_agent_calls integer,
  total_mcp_calls integer,
  total_tokens_used integer,

  created_ts timestamptz,
  updated_ts timestamptz,
  completed_ts timestamptz
);
```

### Table: `orchestrator_state`

Key-value store for session variables.

```sql
CREATE TABLE app.orchestrator_state (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,
  key varchar(100),
  value jsonb,
  value_type varchar(50),
  source varchar(100),
  node_context varchar(100),
  validated boolean,

  created_ts timestamptz,
  updated_ts timestamptz,

  UNIQUE(session_id, key)
);
```

### Table: `orchestrator_agent_log`

Audit trail of all agent actions.

```sql
CREATE TABLE app.orchestrator_agent_log (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,
  agent_role varchar(50),
  agent_action varchar(100),
  node_context varchar(100),

  input_data jsonb,
  output_data jsonb,

  -- LLM usage
  model_used varchar(100),
  tokens_used integer,
  cost_cents integer,

  -- MCP call details
  mcp_tool_name varchar(100),
  mcp_tool_args jsonb,
  mcp_tool_result jsonb,
  mcp_success boolean,

  success boolean,
  error_message text,
  natural_response text,
  duration_ms integer,

  created_ts timestamptz
);
```

### Table: `orchestrator_summary`

LLM-generated conversation summaries.

```sql
CREATE TABLE app.orchestrator_summary (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES orchestrator_session,
  summary_type varchar(50),  -- 'full', 'incremental', 'node_completion'
  summary_text text,
  up_to_node varchar(100),
  message_count integer,
  model_used varchar(100),
  tokens_used integer,

  created_ts timestamptz
);
```

---

## 5. API Endpoints

### POST /api/v1/chat/orchestrator/message

Send a message through the multi-agent orchestrator.

**Request:**
```json
{
  "session_id": "uuid (optional, for continuing session)",
  "message": "I need landscaping service",
  "chat_session_id": "uuid (optional, link to chat)",
  "user_id": "uuid (optional)",
  "tenant_id": "uuid (optional)"
}
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Thanks! Can I get your name and phone number?",
  "intent": "CalendarBooking",
  "currentNode": "identify_customer",
  "requiresUserInput": true,
  "completed": false,
  "agentLogs": [
    {
      "agent": "authenticator",
      "action": "authenticate",
      "success": true
    },
    {
      "agent": "critic",
      "action": "review_conversation",
      "success": true
    },
    {
      "agent": "worker",
      "action": "execute_collect_data",
      "success": true
    }
  ]
}
```

### GET /api/v1/chat/orchestrator/session/:sessionId/status

Get detailed session status.

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "session_number": "ORCH-20251106-0001",
    "current_intent": "CalendarBooking",
    "current_node": "gather_booking_requirements",
    "status": "active",
    "session_context": {
      "customer_id": "uuid",
      "customer_name": "John Doe",
      "service_category": "Landscaping"
    }
  },
  "state": {
    "customer_id": "uuid",
    "customer_name": "John Doe",
    "customer_phone": "6475551234",
    "service_category": "Landscaping",
    "desired_date": "2025-11-15"
  },
  "logs": [
    {
      "agent_role": "worker",
      "agent_action": "mcp_call",
      "mcp_tool_name": "customer_create",
      "success": true,
      "created_ts": "2025-11-06T10:00:00Z"
    }
  ]
}
```

### GET /api/v1/chat/orchestrator/intents

List available intents.

**Response:**
```json
{
  "count": 1,
  "intents": [
    {
      "name": "CalendarBooking",
      "description": "Book a service appointment",
      "version": "v1.0",
      "requiredPermissions": ["customer:read", "customer:write", "booking:write"]
    }
  ]
}
```

### GET /api/v1/chat/orchestrator/intent/:intentName/graph

Get intent graph definition (for debugging/visualization).

**Response:**
```json
{
  "graph": {
    "name": "CalendarBooking",
    "description": "Book a service appointment",
    "version": "v1.0",
    "startNode": "identify_customer",
    "nodes": [
      {
        "id": "identify_customer",
        "name": "Identify Customer",
        "description": "Search for existing customer...",
        "agentRoles": ["worker"],
        "requiredState": [],
        "producesState": ["customer_id", "customer_name"],
        "transitionsTo": ["welcome_existing", "create_customer"]
      }
    ],
    "boundaries": {
      "allowedTopics": ["booking", "scheduling", "landscaping"],
      "forbiddenTopics": ["weather", "news"]
    }
  }
}
```

---

## 6. Usage Examples

### Example 1: Complete Calendar Booking Flow

```bash
# Step 1: Start new session
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need landscaping service"
  }'

# Response:
# {
#   "sessionId": "abc-123",
#   "response": "Hi! Can I get your name and phone number?",
#   "intent": "CalendarBooking",
#   "currentNode": "identify_customer",
#   "requiresUserInput": true
# }

# Step 2: Provide name and phone
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc-123",
    "message": "I'\''m John Doe, 647-555-1234"
  }'

# Response:
# {
#   "sessionId": "abc-123",
#   "response": "Thanks John! Let me get you set up. What'\''s your service address?",
#   "currentNode": "create_customer",
#   "requiresUserInput": true
# }

# Step 3: Provide address
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc-123",
    "message": "123 Main St, Toronto"
  }'

# Response:
# {
#   "sessionId": "abc-123",
#   "response": "Perfect! I'\''ve got your information saved. When would you like us to come?",
#   "currentNode": "gather_booking_requirements",
#   "requiresUserInput": true
# }

# ... continue conversation until completed = true
```

### Example 2: Check Session Status

```bash
curl -X GET http://localhost:4000/api/v1/chat/orchestrator/session/abc-123/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. Creating New Intent Graphs

### Step 1: Define Intent Graph

Create `/apps/api/src/modules/chat/orchestrator/intent-graphs/my-intent.graph.ts`:

```typescript
import type { IntentGraph } from '../types/intent-graph.types.js';

export const MyIntentGraph: IntentGraph = {
  name: 'MyIntent',
  description: 'Handle my custom workflow',
  version: 'v1.0',
  startNode: 'initial_node',

  boundaries: {
    allowedTopics: ['my', 'topics'],
    forbiddenTopics: ['off', 'topic'],
    maxTurns: 20
  },

  requiredPermissions: ['my:permission'],

  nodes: {
    initial_node: {
      id: 'initial_node',
      name: 'Initial Node',
      description: 'First step',
      agentRoles: ['worker'],
      actions: [
        {
          type: 'collect_data',
          collectFields: [
            { key: 'field1', type: 'string', required: true, prompt: 'What is field1?' }
          ]
        }
      ],
      transitions: [
        { toNode: 'next_node', isDefault: true }
      ]
    },

    next_node: {
      // ... define next node
    }
  }
};
```

### Step 2: Register Intent

Edit `/apps/api/src/modules/chat/orchestrator/intent-graphs/index.ts`:

```typescript
import { MyIntentGraph } from './my-intent.graph.js';

export const IntentGraphRegistry: Record<string, IntentGraph> = {
  CalendarBooking: CalendarBookingGraph,
  MyIntent: MyIntentGraph,  // Add here
};
```

### Step 3: Update Intent Detection

Edit `orchestrator.service.ts` `detectIntent()` method:

```typescript
private async detectIntent(message: string, state: Record<string, any>): Promise<IntentDetectionResult> {
  const lowerMessage = message.toLowerCase();

  // Add keywords for your intent
  if (lowerMessage.includes('my') && lowerMessage.includes('intent')) {
    return {
      intent: 'MyIntent',
      confidence: 0.9,
      reasoning: 'Contains my intent keywords'
    };
  }

  // ... other intents
}
```

---

## 8. Best Practices

### Stateful Design

✅ **DO:**
- Store all critical data in `orchestrator_state`
- Use `session_context` for session-wide variables
- Generate summaries after every 5-10 messages
- Mark validated fields explicitly

❌ **DON'T:**
- Rely on LLM memory for workflow state
- Store sensitive data in unencrypted fields
- Skip state updates "to save time"

### Agent Coordination

✅ **DO:**
- Let Worker handle all MCP calls
- Use Evaluator to validate every node
- Run Critic checks before and after Worker
- Log all agent actions for audit trail

❌ **DON'T:**
- Call MCP tools directly from Orchestrator
- Skip validation for "simple" nodes
- Trust Worker output without Critic review

### Intent Graph Design

✅ **DO:**
- Keep nodes focused (single responsibility)
- Define clear transition conditions
- Include response templates for natural language
- Set requiresUserConfirmation for destructive actions

❌ **DON'T:**
- Create nodes with > 5 actions
- Use complex JavaScript expressions in conditions
- Skip validation rules
- Forget boundary enforcement

---

## 9. Troubleshooting

### Issue: "Intent not detected"

**Cause:** Keywords not matching in `detectIntent()`

**Solution:**
1. Check intent keywords in `detectIntent()`
2. Add more synonyms to keyword list
3. Consider using LLM-based intent classification

### Issue: "MCP tool call failed"

**Cause:** Auth token missing or invalid

**Solution:**
1. Verify `Authorization` header is set
2. Check token is valid and not expired
3. Ensure user has required permissions
4. Review `orchestrator_agent_log` for error details

### Issue: "Workflow stuck on same node"

**Cause:** Required state fields not collected

**Solution:**
1. Check `orchestrator_state` for missing fields
2. Review node's `requiredState` definition
3. Ensure Worker `collect_data` is extracting fields
4. Check Evaluator logs for validation failures

### Issue: "Off-topic detected incorrectly"

**Cause:** Critic's topic matching too strict

**Solution:**
1. Add more `allowedTopics` to intent graph
2. Adjust Critic's `detectOffTopic()` logic
3. Consider semantic similarity vs keyword matching

---

## 10. Performance Considerations

### Token Usage

- **Small models recommended:** gpt-3.5-turbo, Claude Haiku
- **Average tokens per message:** 500-1500
- **Summaries reduce context:** Generate after every 10 messages
- **State persistence reduces tokens:** Don't re-send full history

### Database Queries

- **State lookups:** Indexed on `(session_id, key)`
- **Agent logs:** Indexed on `(session_id, created_ts DESC)`
- **Session retrieval:** Indexed on `session_number`

### Optimization Tips

1. Use `maxTools` in MCP adapter to limit token overhead
2. Cache intent graphs in memory (already done via registry)
3. Limit `orchestrator_agent_log` retention to 30 days
4. Use connection pooling for PostgreSQL (already configured)

---

## 11. Security Considerations

### Authentication

- Always validate JWT tokens via `AuthenticatorAgent`
- Check `requiredPermissions` before executing intent
- Log all auth failures in `orchestrator_agent_log`

### Authorization

- MCP tools use authenticated API calls (RBAC enforced)
- Customer data access controlled by tenant_id
- Admin-only intents require explicit permission checks

### Data Privacy

- PII stored in `orchestrator_state` (encrypted at rest)
- Conversation summaries may contain PII - handle accordingly
- Agent logs include user data - restrict access

---

## Quick Reference

**Core Files:**
- `orchestrator.service.ts` - Main coordinator
- `agents/authenticator.agent.ts` - Auth validation
- `agents/worker.agent.ts` - Task execution
- `agents/evaluator.agent.ts` - Output validation
- `agents/critic.agent.ts` - Quality control
- `state/state-manager.service.ts` - Persistence layer
- `intent-graphs/calendar-booking.graph.ts` - Example workflow

**Database:**
- `orchestrator_session` - Session state
- `orchestrator_state` - Key-value store
- `orchestrator_agent_log` - Audit trail
- `orchestrator_summary` - Conversation summaries

**APIs:**
- `POST /orchestrator/message` - Send message
- `GET /orchestrator/session/:id/status` - Session status
- `GET /orchestrator/intents` - List intents
- `GET /orchestrator/intent/:name/graph` - Graph definition

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-11-06
