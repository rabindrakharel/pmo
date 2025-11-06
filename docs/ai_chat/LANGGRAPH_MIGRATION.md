# LangGraph Migration Guide

**Version:** 2.0.0 | **Status:** Production | **Updated:** 2025-11-06

---

## Overview

The orchestrator has been migrated from a custom multi-agent framework to **LangGraph**, an industry-standard open-source framework for building stateful, multi-actor applications with LLMs.

## Why LangGraph?

### Benefits

1. **Industry Standard**: LangGraph is maintained by LangChain and used by thousands of companies
2. **Built-in State Management**: Native state persistence with checkpointing
3. **Better Debugging**: LangSmith integration for visualization and debugging
4. **Community Support**: Active development, extensive documentation, and community plugins
5. **Production Ready**: Battle-tested in production environments
6. **Easier to Extend**: Standard patterns for adding new workflows and nodes

### Migration Rationale

- **Custom → Standard**: Moving from custom code to industry-standard framework reduces maintenance burden
- **Future-Proof**: LangGraph receives continuous updates and improvements
- **Developer Experience**: Easier onboarding for developers familiar with LangChain ecosystem
- **Tooling**: Access to LangGraph Studio, LangSmith, and other ecosystem tools

---

## Architecture Changes

### Before (Custom Orchestrator)

```
User Message
  ↓
Custom Orchestrator Service
  ├─ Authenticator Agent (class)
  ├─ Orchestrator Agent (class)
  ├─ Worker Agent (class)
  ├─ Evaluator Agent (class)
  └─ Critic Agent (class)
  ↓
Custom State Manager (PostgreSQL)
  ↓
Response
```

### After (LangGraph)

```
User Message
  ↓
LangGraph Orchestrator Service
  ↓
LangGraph StateGraph
  ├─ entry (node function)
  ├─ critic (node function)
  ├─ identify_customer (node function)
  ├─ welcome_existing (node function)
  ├─ create_customer (node function)
  ├─ gather_booking_requirements (node function)
  ├─ find_available_slots (node function)
  ├─ propose_options (node function)
  ├─ create_booking (node function)
  └─ confirm_and_summarize (node function)
  ↓
PostgreSQL Checkpointer (reuses existing tables)
  ↓
Response
```

### Key Differences

| Aspect | Custom | LangGraph |
|--------|--------|-----------|
| **Agents** | Class-based agents | Node functions |
| **State** | Custom state manager | Built-in state annotation |
| **Transitions** | Evaluator determines next node | Conditional edges |
| **Persistence** | Manual database writes | Automatic checkpointing |
| **Debugging** | Console logs | LangSmith visualization |
| **Intent Graphs** | Data structures | StateGraph definition |

---

## API Changes

### New Endpoints

All LangGraph endpoints are under `/api/v1/chat/langgraph/`

#### Process Message
```bash
POST /api/v1/chat/langgraph/message
Content-Type: application/json
Authorization: Bearer <token>

{
  "session_id": "optional-uuid",
  "message": "I need landscaping service",
  "chat_session_id": "optional-uuid",
  "user_id": "optional-uuid"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "response": "Hi! I'd be happy to help...",
  "intent": "CalendarBooking",
  "currentNode": "identify_customer",
  "requiresUserInput": true,
  "completed": false,
  "conversationEnded": false,
  "engagingMessage": "Checking availability..."
}
```

#### Get Session Status
```bash
GET /api/v1/chat/langgraph/session/:id/status
```

#### List Intents
```bash
GET /api/v1/chat/langgraph/intents
```

#### Health Check
```bash
GET /api/v1/chat/langgraph/health
```

### Old Endpoints (Deprecated)

The custom orchestrator endpoints at `/api/v1/chat/orchestrator/` are still available for backward compatibility but will be removed in v3.0.

---

## Migration Path

### For Frontend Developers

**Before:**
```typescript
const response = await fetch('/api/v1/chat/orchestrator/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    session_id: sessionId,
    message: userMessage,
  }),
});
```

**After:**
```typescript
const response = await fetch('/api/v1/chat/langgraph/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    session_id: sessionId,
    message: userMessage,
  }),
});
```

**Response format is identical**, so no changes needed to response handling.

### For Backend Developers

#### Adding New Workflows

**Before (Custom):**
```typescript
// 1. Create intent graph file
export const MyWorkflowGraph: IntentGraph = {
  name: 'MyWorkflow',
  startNode: 'start',
  nodes: { /* nodes */ },
  boundaries: { /* boundaries */ },
};

// 2. Register in IntentGraphRegistry
IntentGraphRegistry.MyWorkflow = MyWorkflowGraph;

// 3. Update detectIntent() function
```

**After (LangGraph):**
```typescript
// 1. Create LangGraph file
export function createMyWorkflowGraph(mcpAdapter: any) {
  const graph = new StateGraph(OrchestratorStateAnnotation)
    .addNode('start', startNode)
    .addNode('next', nextNode)
    .addEdge(START, 'start')
    .addConditionalEdges('start', routeNextNode);

  return graph.compile();
}

// 2. Register in LangGraphOrchestratorService
this.graphs.set('MyWorkflow', createMyWorkflowGraph(this.mcpAdapter));
```

#### Defining Nodes

**Before (Custom):**
```typescript
// Node defined in intent graph JSON
{
  id: 'create_customer',
  agentRoles: ['worker'],
  actions: [
    { type: 'mcp_call', mcpTool: 'customer_create', /* ... */ }
  ],
  validations: [ /* ... */ ],
  transitions: [ /* ... */ ]
}
```

**After (LangGraph):**
```typescript
// Node defined as function
async function createCustomerNode(
  state: OrchestratorState,
  mcpAdapter: any
): Promise<StateUpdate> {
  // Check if we have required data
  if (!state.variables.customer_address) {
    return {
      naturalResponse: "What's your address?",
      requiresUserInput: true,
    };
  }

  // Execute MCP call
  const result = await mcpAdapter.executeMCPTool('customer_create', {
    body_name: state.variables.customer_name,
    // ...
  }, state.authToken);

  // Return state updates
  return {
    variables: {
      customer_id: result.id,
    },
    naturalResponse: "Perfect! I've created your profile.",
  };
}
```

---

## Features Preserved

All features from the custom orchestrator are preserved in LangGraph:

- ✅ **Stateful workflows** - State persisted in PostgreSQL
- ✅ **Multi-agent coordination** - Agents implemented as nodes
- ✅ **Intent graphs** - Converted to StateGraph
- ✅ **MCP integration** - All tool calls via MCP adapter
- ✅ **Conversation boundaries** - Critic node enforces boundaries
- ✅ **Off-topic handling** - Auto-goodbye after 2 attempts
- ✅ **Engaging messages** - Shown during processing
- ✅ **Agent-specific models** - Configurable per node
- ✅ **Audit trail** - Agent actions logged to database
- ✅ **Session resumption** - Checkpointing enables pause/resume

---

## Database Schema

LangGraph reuses the existing orchestrator database tables:

- `orchestrator_session` - Session metadata
- `orchestrator_state` - Key-value state variables
- `orchestrator_agent_log` - Agent action audit trail
- `orchestrator_summary` - Conversation summaries

No database migration required!

---

## Development Workflow

### Running Locally

```bash
# 1. Install dependencies (already done)
cd /home/user/pmo/apps/api
pnpm install

# 2. Start services
./tools/start-all.sh

# 3. Test LangGraph orchestrator
curl -X POST http://localhost:4000/api/v1/chat/langgraph/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "I need landscaping service"}'
```

### Debugging

#### Enable Verbose Logging
```typescript
// In langgraph-orchestrator.service.ts
console.log('[LangGraph] State before node:', state);
console.log('[LangGraph] State after node:', result);
```

#### Use LangSmith (Optional)
```bash
# Set environment variables
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=<your-key>
export LANGCHAIN_PROJECT=pmo-orchestrator

# Traces will appear in LangSmith dashboard
```

---

## Testing

### Unit Tests

```typescript
import { createCalendarBookingGraph } from './calendar-booking.langgraph.js';

describe('CalendarBooking LangGraph', () => {
  it('should create graph', () => {
    const mockMCP = { executeMCPTool: jest.fn() };
    const graph = createCalendarBookingGraph(mockMCP);
    expect(graph).toBeDefined();
  });

  it('should handle identify_customer node', async () => {
    const state: OrchestratorState = {
      sessionId: 'test',
      currentNode: 'identify_customer',
      variables: {
        customer_name: 'John',
        customer_phone: '1234567890',
      },
      // ...
    };

    const result = await graph.invoke(state);
    expect(result.currentNode).toBe('create_customer');
  });
});
```

### Integration Tests

```bash
# Test calendar booking flow
./tools/test-api.sh POST /api/v1/chat/langgraph/message \
  '{"message": "I need landscaping service"}'

# Get session status
./tools/test-api.sh GET /api/v1/chat/langgraph/session/<session-id>/status
```

---

## Performance Considerations

### Checkpointing Overhead

LangGraph checkpointing adds ~5-10ms per node:
- **Before**: 0 database writes per node (manual batching)
- **After**: 1 checkpoint save per node (automatic)

**Mitigation**: Checkpoints are asynchronous and don't block response.

### Memory Usage

- **Before**: State kept in memory between nodes
- **After**: State serialized/deserialized from database

**Impact**: Negligible (state is small, ~1-5KB per session)

---

## Troubleshooting

### Issue: "No graph found for intent"

**Cause**: Intent not registered in `initializeGraphs()`

**Fix**:
```typescript
// In langgraph-orchestrator.service.ts
private initializeGraphs() {
  this.graphs.set('MyIntent', createMyIntentGraph(this.mcpAdapter));
}
```

### Issue: "State not persisting"

**Cause**: Checkpointer not saving state

**Fix**: Check PostgreSQL connection and table permissions

### Issue: "Node not transitioning"

**Cause**: Conditional edge logic incorrect

**Fix**: Add logging to `routeNextNode()`:
```typescript
function routeNextNode(state: OrchestratorState): string {
  console.log('[Route] Current node:', state.currentNode);
  console.log('[Route] State:', state.variables);
  // ...
}
```

---

## Roadmap

### Completed (v2.0)
- ✅ Migrate CalendarBooking workflow to LangGraph
- ✅ PostgreSQL checkpointer implementation
- ✅ API endpoints for LangGraph orchestrator
- ✅ Backward compatibility with custom orchestrator

### Upcoming (v2.1)
- 🔲 Voice orchestrator integration with LangGraph
- 🔲 LangSmith integration for debugging
- 🔲 Additional intent graphs (ComplaintHandling, JobFollowUp)
- 🔲 Streaming responses for real-time updates

### Future (v3.0)
- 🔲 Remove custom orchestrator (breaking change)
- 🔲 LangGraph Studio integration
- 🔲 Multi-turn summarization with LLM
- 🔲 Intent detection using LLM instead of keywords

---

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph Tutorials](https://langchain-ai.github.io/langgraph/tutorials/)
- [LangSmith](https://smith.langchain.com/)
- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)

---

**For questions or issues, contact the development team or create an issue in the repository.**
