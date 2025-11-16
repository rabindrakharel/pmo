# Agent Orchestrator Service

> **Multi-agent coordination and workflow execution**

**File**: `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`
**Used By**: Chat routes, Voice Orchestrator Service

---

## How It Works

Coordinates multiple specialized AI agents to handle complex multi-step tasks. Routes user requests to appropriate agents based on intent, manages agent lifecycle, aggregates agent outputs, and maintains conversation state across agent handoffs.

**Core Capabilities**:
- Agent registration and discovery
- Intent-based routing to specialized agents
- Inter-agent communication and data passing
- Result aggregation from parallel agents
- Fallback handling when agents fail

**Agent Types Managed**:
- **Unified Goal Agent** - General-purpose task execution
- **Data Extraction Agent** - Extract structured data from conversations
- **Context Initializer** - Load initial context for new conversations
- **DAG Loader** - Load workflow definitions

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AGENT ORCHESTRATOR                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐      ┌──────────────────────┐      │
│  │  Intent Analyzer   │      │   Agent Registry     │      │
│  │  - Parse request   │      │   - Register agents  │      │
│  │  - Classify intent │      │   - Agent discovery  │      │
│  │  - Extract params  │      │   - Capability map   │      │
│  └─────────┬──────────┘      └──────────┬───────────┘      │
│            │                            │                    │
│            ▼                            ▼                    │
│  ┌────────────────────────────────────────────────┐        │
│  │           Agent Router                          │        │
│  │  - Match intent to agent                       │        │
│  │  - Priority-based selection                    │        │
│  │  - Parallel execution support                  │        │
│  └──────────────────┬─────────────────────────────┘        │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Execution Manager                        │   │
│  │  - Agent invocation                                 │   │
│  │  - Context passing                                  │   │
│  │  - Error handling                                   │   │
│  │  - Result collection                                │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────┐    ┌──────────────────┐           │
│  │  Result Aggregator │    │  State Manager   │           │
│  │  - Merge outputs   │    │  - Track progress│           │
│  │  - Format response │    │  - Save state    │           │
│  └────────────────────┘    └──────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐              ┌──────────────────────┐
│ Specialized     │              │  Database            │
│ Agents:         │              │  - Session state     │
│ - Goal Agent    │              │  - Agent logs        │
│ - Data Extract  │              │  - Execution history │
│ - DAG Loader    │              └──────────────────────┘
└─────────────────┘
```

**Component Responsibilities**:

**Intent Analyzer**:
- Parses natural language user requests
- Classifies into intent categories (create_entity, search, workflow, etc.)
- Extracts parameters from request

**Agent Registry**:
- Maintains list of available agents
- Maps agent capabilities to intents
- Provides agent discovery

**Agent Router**:
- Selects appropriate agent(s) for intent
- Supports single-agent or multi-agent execution
- Handles priority and fallback logic

**Execution Manager**:
- Invokes selected agents
- Passes conversation context
- Handles timeouts and errors
- Collects results

**Result Aggregator**:
- Merges outputs from multiple agents
- Formats unified response
- Resolves conflicting outputs

**State Manager**:
- Persists conversation state
- Tracks agent execution history
- Enables conversation resume

---

## Operational Flow

### Single-Agent Request

**Sequence**:
1. User sends: "Create a project called Kitchen Renovation"
2. Orchestrator receives request
3. Intent Analyzer classifies as `create_entity` intent
4. Agent Router selects Unified Goal Agent
5. Execution Manager invokes Goal Agent with:
   - User request
   - Conversation history
   - Available functions
6. Goal Agent processes request:
   - Calls LLM with function definitions
   - LLM decides to call `create_project` function
   - Goal Agent executes function
   - Returns result
7. Result Aggregator formats response
8. Orchestrator returns: "Project created successfully"
9. State Manager saves execution log

### Multi-Agent Parallel Execution

**Sequence**:
1. User sends: "Find all active projects and extract customer names from them"
2. Intent Analyzer detects two sub-intents:
   - `search_entities` (find projects)
   - `extract_data` (extract customer names)
3. Agent Router selects two agents:
   - Unified Goal Agent (search)
   - Data Extraction Agent (extraction)
4. Execution Manager invokes both agents in parallel:
   - Goal Agent queries projects
   - Extraction Agent waits for project data
5. Goal Agent returns project list
6. Extraction Agent receives project data
7. Extraction Agent extracts customer names
8. Result Aggregator merges results:
   ```json
   {
     "projects": [...],
     "customers": ["ABC Corp", "XYZ Ltd"]
   }
   ```
9. Orchestrator returns unified response
10. State Manager saves both agent executions

### Agent Handoff (Sequential)

**Sequence**:
1. User sends: "Load the construction workflow and execute step 1"
2. Intent Analyzer classifies as `workflow_execution`
3. Agent Router creates agent chain:
   - DAG Loader Agent (load workflow)
   - Unified Goal Agent (execute step)
4. Execution Manager invokes DAG Loader first:
   - Loads workflow definition from database
   - Returns workflow structure
5. Execution Manager passes workflow to Goal Agent:
   - Goal Agent receives workflow context
   - Executes step 1 (e.g., create project)
   - Returns execution result
6. Result Aggregator formats response
7. Orchestrator returns: "Loaded construction workflow, executed step 1: Project created"
8. State Manager saves workflow state for next step

### Error Handling and Fallback

**Sequence**:
1. User sends complex request
2. Intent Analyzer classifies intent
3. Agent Router selects specialized agent
4. Execution Manager invokes agent
5. Agent encounters error (timeout, API failure, etc.)
6. Execution Manager catches error
7. Agent Router selects fallback agent (General Goal Agent)
8. Execution Manager retries with fallback agent
9. Fallback agent processes request
10. If fallback succeeds → Return result
11. If fallback fails → Return error to user
12. State Manager logs failure for debugging

### Context-Aware Continuation

**Sequence**:
1. User's first message: "Create a project for ABC Corp"
2. Orchestrator executes, returns project ID
3. State Manager saves:
   - User intent: create_project
   - Result: project_id = "abc-123"
   - Context: business = "ABC Corp"
4. User's second message: "Add a task to it"
5. Orchestrator loads previous context
6. Intent Analyzer uses context to resolve "it" → project_id "abc-123"
7. Agent Router selects Goal Agent
8. Goal Agent creates task with parent_id = "abc-123"
9. Returns result with full context
10. State Manager updates conversation state

---

**File**: `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`
