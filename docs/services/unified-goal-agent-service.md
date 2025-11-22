# Unified Goal Agent Service

> **General-purpose AI agent for goal-driven task execution with function calling**

**File**: `apps/api/src/modules/chat/orchestrator/agents/unified-goal-agent.service.ts`
**Used By**: Agent Orchestrator Service, Chat routes, Voice Orchestrator Service

---

## How It Works

Executes user requests by combining LLM reasoning with function calling to perform entity operations, searches, and multi-step workflows. Acts as the default agent for most user requests that don't require specialized handling.

**Core Capabilities**:
- Natural language understanding and intent extraction
- Function calling for entity CRUD operations
- Multi-step task execution with planning
- Error recovery and retry logic
- Context-aware conversation continuation

**Supported Operations**:
- Create, update, delete entities (project, task, customer, etc.)
- Search and filter entities by criteria
- Retrieve entity details and relationships
- Execute workflows and multi-step procedures
- Answer questions about data

---

## Component Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  UNIFIED GOAL AGENT                            │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────┐       ┌────────────────────────┐   │
│  │  Goal Parser         │       │  Context Builder       │   │
│  │  - Extract intent    │       │  - Load conversation   │   │
│  │  - Identify params   │       │  - Build system prompt │   │
│  │  - Detect multi-step │       │  - Include functions   │   │
│  └──────────┬───────────┘       └────────────┬───────────┘   │
│             │                                │                │
│             └────────────┬───────────────────┘                │
│                          ▼                                     │
│            ┌─────────────────────────────┐                    │
│            │     LLM Planner             │                    │
│            │  - Reason about task        │                    │
│            │  - Select functions         │                    │
│            │  - Plan execution order     │                    │
│            └──────────────┬──────────────┘                    │
│                           │                                    │
│                           ▼                                    │
│            ┌─────────────────────────────┐                    │
│            │   Function Executor         │                    │
│            │  - Validate arguments       │                    │
│            │  - Execute function calls   │                    │
│            │  - Handle errors            │                    │
│            │  - Collect results          │                    │
│            └──────────────┬──────────────┘                    │
│                           │                                    │
│            ┌──────────────┴──────────────┐                    │
│            ▼                              ▼                    │
│  ┌──────────────────┐         ┌──────────────────────┐       │
│  │  Result Formatter│         │  Memory Manager      │       │
│  │  - Format output │         │  - Save conversation │       │
│  │  - Natural lang  │         │  - Track state       │       │
│  └──────────────────┘         └──────────────────────┘       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────┐        ┌──────────────────────────┐
│  Functions Service  │        │  Database                │
│  - CRUD operations  │        │  - Entity tables         │
│  - Search           │        │  - Conversation history  │
│  - Aggregations     │        │  - Agent logs            │
└─────────────────────┘        └──────────────────────────┘
```

**Component Responsibilities**:

**Goal Parser**:
- Extracts user's goal from natural language
- Identifies required parameters
- Detects if task requires multiple steps

**Context Builder**:
- Loads recent conversation history
- Constructs system prompt with instructions
- Includes available function definitions
- Adds user context (permissions, preferences)

**LLM Planner**:
- Sends context to LLM
- LLM reasons about task
- Selects appropriate functions to call
- Plans execution order for multi-step tasks

**Function Executor**:
- Receives function calls from LLM
- Validates function arguments
- Dispatches to Functions Service
- Handles errors and retries
- Returns results to LLM

**Result Formatter**:
- Takes LLM's final response
- Formats for user display
- Adds metadata (entities created, etc.)

**Memory Manager**:
- Saves conversation to database
- Tracks execution state
- Enables conversation resume

---

## Operational Flow

### Simple Entity Creation

**Sequence**:
1. User sends: "Create a project called Kitchen Renovation for ABC Corp"
2. Goal Parser extracts:
   - Intent: create_project
   - Parameters: name="Kitchen Renovation", business="ABC Corp"
3. Context Builder prepares LLM context:
   - System prompt: "You are a project management assistant..."
   - Conversation history: (empty for first message)
   - Function list: [create_project, update_project, ...]
   - User message: "Create a project..."
4. LLM Planner analyzes request:
   - Decides to call `create_project` function
   - Prepares arguments: `{ name: "Kitchen Renovation", business_id: "abc-uuid" }`
5. Function Executor:
   - Validates arguments (name is string, business_id is valid UUID)
   - Calls Functions Service → create_project
   - Functions Service inserts into d_project table
   - Returns: `{ id: "proj-123", name: "Kitchen Renovation", ... }`
6. Result sent back to LLM
7. LLM generates response: "I've created the Kitchen Renovation project for ABC Corp"
8. Result Formatter returns formatted response
9. Memory Manager saves conversation

### Multi-Step Task Execution

**Sequence**:
1. User sends: "Create a project called Bathroom Remodel for XYZ Ltd and add a task to order tiles"
2. Goal Parser detects multi-step:
   - Step 1: Create project
   - Step 2: Create task under project
3. Context Builder includes conversation history + functions
4. LLM Planner creates execution plan:
   - First call: `create_project`
   - Wait for project ID
   - Second call: `create_task` with parent_id=project_id
5. Function Executor executes Step 1:
   - Calls create_project
   - Returns: `{ id: "proj-456", name: "Bathroom Remodel" }`
6. LLM receives project ID
7. Function Executor executes Step 2:
   - Calls create_task with:
     ```json
     {
       "name": "Order tiles",
       "parent_type": "project",
       "parent_id": "proj-456"
     }
     ```
   - Returns: `{ id: "task-789", name: "Order tiles" }`
8. LLM generates final response: "I've created the Bathroom Remodel project and added a task to order tiles"
9. Memory Manager saves both operations

### Search with Filters

**Sequence**:
1. User sends: "Show me all active projects for ABC Corp that started this year"
2. Goal Parser extracts:
   - Intent: search_entities
   - Entity type: project
   - Filters: active=true, business="ABC Corp", start_date >= "2025-01-01"
3. Context Builder prepares LLM context with search functions
4. LLM Planner decides to call `search_entities` function:
   ```json
   {
     "entity_code": "project",
     "filters": {
       "active_flag": true,
       "business_id": "abc-uuid",
       "start_date_gte": "2025-01-01"
     }
   }
   ```
5. Function Executor:
   - Validates arguments
   - Calls Functions Service → search_entities
   - Functions Service builds SQL query with filters
   - Applies RBAC filtering (user permissions)
   - Executes query
   - Returns: `[{ id: "proj-1", name: "Kitchen Renovation" }, ...]`
6. LLM receives results
7. LLM formats results in natural language:
   "I found 3 active projects for ABC Corp that started this year:
   1. Kitchen Renovation
   2. Bathroom Remodel
   3. Deck Construction"
8. Result Formatter returns formatted list
9. Memory Manager saves query

### Error Handling and Retry

**Sequence**:
1. User sends: "Update project XYZ to mark it complete"
2. Goal Parser extracts:
   - Intent: update_project
   - Project: "XYZ" (name, not ID)
3. Context Builder prepares context
4. LLM Planner calls `search_entities` first:
   - Searches for project with name="XYZ"
   - Finds project ID: "proj-xyz-uuid"
5. LLM Planner calls `update_project`:
   ```json
   {
     "id": "proj-xyz-uuid",
     "dl__project_stage": "completed"
   }
   ```
6. Function Executor validates and calls update
7. If update fails (e.g., user lacks permission):
   - Function Executor catches error
   - Returns error to LLM
   - LLM explains error to user: "I don't have permission to update that project"
8. If update succeeds:
   - Returns updated project
   - LLM confirms: "Project XYZ has been marked complete"
9. Memory Manager saves operation

### Contextual Follow-Up

**Sequence**:
1. User's first message: "Create a project called Office Renovation"
2. Agent creates project, returns: `{ id: "proj-abc" }`
3. Memory Manager saves:
   - User intent: create_project
   - Result: project_id="proj-abc"
   - Context: current_entity = "project:proj-abc"
4. User's second message: "Add a task to order furniture"
5. Goal Parser loads previous context
6. Detects implicit parent: project "proj-abc"
7. Context Builder includes conversation history
8. LLM Planner understands "Add a task to it" means parent_id="proj-abc"
9. Calls `create_task`:
   ```json
   {
     "name": "Order furniture",
     "parent_type": "project",
     "parent_id": "proj-abc"
   }
   ```
10. Function Executor creates task linked to project
11. Returns confirmation
12. Memory Manager updates context

---

**File**: `apps/api/src/modules/chat/orchestrator/agents/unified-goal-agent.service.ts`
