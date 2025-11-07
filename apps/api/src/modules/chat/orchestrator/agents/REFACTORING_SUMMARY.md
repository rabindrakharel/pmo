# Agent Refactoring Summary

## Overview

Successfully refactored the agent system from a single `WorkerAgent` into two specialized worker agents as per the architecture specification.

## Changes Made

### 1. Created WorkerReplyAgent (`worker-reply-agent.service.ts`)

**Purpose**: Generate natural customer-facing responses ONLY

**Responsibilities**:
- Read conversation history from `context.summary_of_conversation_on_each_step_until_now`
- Understand node role, goal, and prompt examples
- Generate natural 1-2 sentence responses
- NO context extraction or updates

**Result Interface**:
```typescript
interface WorkerReplyResult {
  response: string; // Customer-facing response only
}
```

### 2. Created WorkerMCPAgent (`worker-mcp-agent.service.ts`)

**Purpose**: Execute MCP tools and update context with results

**Responsibilities**:
- Analyze context to identify missing fields
- Decide which MCP tool to use based on missing data
- Execute MCP tool with parameters from context
- Map MCP tool results to context fields
- Return context updates for orchestrator to merge

**Result Interface**:
```typescript
interface WorkerMCPResult {
  statusMessage: string; // Optional status to customer
  contextUpdates: Partial<DAGContext>; // Fields to merge into context
  mcpExecuted: boolean;
  mcpResults?: any;
}
```

### 3. Updated AgentOrchestrator (`agent-orchestrator.service.ts`)

**Changes**:
- Imports both `WorkerReplyAgent` and `WorkerMCPAgent`
- Initializes both agents during startup
- Routes to correct worker based on node configuration:
  - **Reply nodes** (`node_action === 'reply'`) → `WorkerReplyAgent`
  - **MCP nodes** (`use_mcp_to_get_info`, `Execute_Plan_Using_MCP`) → `WorkerMCPAgent`
- Handles different result types from each worker
- Merges context updates using non-destructive rules

**Routing Logic**:
```typescript
const isMCPNode = state.currentNode === 'use_mcp_to_get_info' ||
                  state.currentNode === 'Execute_Plan_Using_MCP' ||
                  nodeAction === 'mcp';

if (isMCPNode) {
  // Use WorkerMCPAgent
} else {
  // Use WorkerReplyAgent
}
```

### 4. Updated agent_config.json

**Added**:
- `worker_reply_agent` profile with responsibilities for response generation
- `worker_mcp_agent` profile with responsibilities for MCP tool execution
- Updated `collaboration_flow` to reflect new architecture

**Removed**:
- Old `worker_agent` profile (replaced by two specialized profiles)

## Agent Collaboration Flow (Updated)

1. **Orchestrator** checks node type and chooses correct worker agent
2. **If reply node** → `WorkerReplyAgent` generates customer-facing response (1-2 sentences)
3. **If MCP node** → `WorkerMCPAgent` executes MCP tool and returns context updates
4. **Orchestrator** merges `contextUpdates` into `context.json` using non-destructive rules
5. **NavigatorAgent** reviews updated context and validates conversation direction
6. **NavigatorAgent** decides `next_node_to_go_to` based on branching conditions
7. **Orchestrator** transitions to next node and repeats cycle

## Context Update Rules (Maintained)

All context updates remain **NON-DESTRUCTIVE**:

- **Arrays** (`summary_of_conversation_on_each_step_until_now`, `node_traversal_path`): APPEND only
- **Scalar fields**: UPDATE only if new value is meaningful (not empty/null/undefined)
- **Logging**: All updates logged with clear indicators (`[NEW]`, `[UPDATED]`, array counts)

## Implementation Benefits

1. **Separation of Concerns**: Each worker has a single, clear responsibility
2. **Type Safety**: Different result interfaces for each worker type
3. **Maintainability**: Easier to understand and modify each agent independently
4. **Flexibility**: Easy to add more specialized workers in the future
5. **Configuration-Driven**: Agent behavior defined in `agent_config.json`

## Outstanding Question: Context Extraction

**Issue**: In the original `WorkerAgent`, there was an `extractInformation()` method that extracted fields like:
- `customer_name`
- `customer_phone_number`
- `customers_main_ask`

**Current State**:
- `WorkerReplyAgent` ONLY generates responses (no extraction)
- `WorkerMCPAgent` ONLY calls MCP tools (no extraction from user messages)

**Question**: Where should context extraction from user messages happen?

**Options**:
1. **Separate ExtractorAgent**: Third worker type dedicated to extraction
2. **Orchestrator-level extraction**: Orchestrator extracts fields after reply is generated
3. **Navigator-level extraction**: Navigator extracts fields before routing
4. **Keep in WorkerReplyAgent**: Add extraction back to WorkerReplyAgent (contradicts "only reply" principle)

## Files Modified

- ✅ `/apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts` (NEW)
- ✅ `/apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts` (NEW)
- ✅ `/apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts` (UPDATED)
- ✅ `/apps/api/src/modules/chat/orchestrator/agent_config.json` (UPDATED)

## Next Steps

1. ⏳ **Clarify**: Where should context extraction from user messages happen?
2. ⏳ **Test**: Run the refactored system with actual conversations
3. ⏳ **Verify**: Ensure all nodes work correctly with new worker routing
4. ⏳ **Document**: Update any additional documentation if needed

## Testing Checklist

- [ ] Test reply nodes (GREET_CUSTOMER, Identify_Issue, etc.)
- [ ] Test MCP nodes (use_mcp_to_get_info, Execute_Plan_Using_MCP)
- [ ] Verify context updates are non-destructive
- [ ] Verify conversation history prevents repetition
- [ ] Verify MCP tool execution and context mapping
- [ ] Verify Navigator routing decisions
- [ ] Test full conversation flow end-to-end
