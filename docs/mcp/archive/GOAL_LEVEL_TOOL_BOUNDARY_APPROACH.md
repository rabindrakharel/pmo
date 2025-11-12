# Goal-Level Tool Boundary with Semantic Search

> **Date:** 2025-11-09
> **Context:** Alternative approach to entity boundary filtering - goal-centric with semantic search
> **Key Insight:** Tool and entity boundaries are **predefined in goal state nodes**, not dynamically determined

---

## 🎯 Core Concept

Instead of dynamically determining entity boundaries at runtime, **each goal defines its own tool/entity boundaries** upfront. When the goal activates:

1. **Semantic search** on MCP manifest based on boundaries
2. **Send search results** (tool descriptions with context) to LLM
3. **LLM constructs command** by selecting from available tools

---

## 📊 Architecture Comparison

### Previous Approach (Dynamic Entity Boundary)

```typescript
// Runtime: Agent determines boundary based on context
determineEntityBoundary(state) {
  if (state.data.service?.catalog_match) {
    return ["Customer", "Task", "Product", "Sales"];
  }
  return ["Customer", "Task"];
}

// Filter tools by categories
getMCPTools({ categories: entityBoundary });

// LLM function calling with filtered tools
```

**Issues:**
- Complex runtime logic
- Agent must "guess" what tools are needed
- Expansion rules hardcoded in agent profile
- Hard to debug (dynamic behavior)

---

### New Approach (Goal-Level Boundaries)

```json
{
  "goal_id": "EXECUTE_SOLUTION",
  "description": "Execute the planned actions",
  "primary_agent": "mcp_agent",

  "tool_boundary": {
    "operations": ["create", "book", "link", "update"],
    "exclude_operations": ["delete", "admin"]
  },

  "entity_boundary": {
    "entities": ["Task", "Calendar", "Customer", "Employee"],
    "categories": ["Task", "Calendar", "Customer", "Linkage"]
  },

  "available_tools": ["task_create", "person_calendar_book", "entity_linkage_create"]
}
```

**At Runtime:**
```typescript
// 1. Load goal's boundaries
const goal = getCurrentGoal(state);
const toolBoundary = goal.tool_boundary;
const entityBoundary = goal.entity_boundary;

// 2. Semantic search on manifest
const searchResults = semanticSearchManifest({
  operations: toolBoundary.operations,
  entities: entityBoundary.entities,
  categories: entityBoundary.categories,
  exclude: toolBoundary.exclude_operations
});

// 3. Build tool context for LLM
const toolContext = searchResults.map(tool => ({
  name: tool.name,
  description: tool.description,
  category: tool.category,
  parameters: tool.parameters
}));

// 4. LLM constructs command
const llmPrompt = `
Available tools for this goal:
${JSON.stringify(toolContext, null, 2)}

Based on the current context and plan, which tool should be called and with what arguments?
Context: ${JSON.stringify(state.context)}
`;

// 5. LLM response
{
  "tool": "task_create",
  "arguments": {
    "body_name": "Fix water heater",
    "body_descr": "Customer: John Doe\nPhone: 555-1234\n..."
  }
}
```

**Benefits:**
- ✅ **Explicit** - Goal declares exactly what it needs
- ✅ **Debuggable** - Tool scope visible in config
- ✅ **Maintainable** - No complex runtime logic
- ✅ **Semantic** - Search by operation + entity, not just category
- ✅ **LLM-friendly** - Tool descriptions guide selection

---

## 🏗️ Config Structure

### Goal Node with Tool/Entity Boundaries

```json
{
  "goals": [
    {
      "goal_id": "UNDERSTAND_REQUEST",
      "description": "Understand what the customer needs help with",
      "primary_agent": "conversational_agent",

      "tool_boundary": {
        "operations": ["list", "search"],
        "exclude_operations": ["create", "update", "delete"]
      },

      "entity_boundary": {
        "entities": ["Service", "Product"],
        "categories": ["Settings", "Product", "Sales"]
      },

      "available_tools": ["service_list", "setting_list", "product_search"]
    },

    {
      "goal_id": "GATHER_REQUIREMENTS",
      "description": "Collect necessary customer information",
      "primary_agent": "conversational_agent",
      "fallback_agent": "mcp_agent",

      "tool_boundary": {
        "operations": ["get", "search", "create"],
        "exclude_operations": ["delete", "admin"]
      },

      "entity_boundary": {
        "entities": ["Customer"],
        "categories": ["Customer", "Settings"]
      },

      "available_tools": ["customer_get", "customer_create", "setting_list"]
    },

    {
      "goal_id": "DESIGN_SOLUTION",
      "description": "Create plan to resolve customer request",
      "primary_agent": "planner_agent",
      "fallback_agent": "mcp_agent",

      "tool_boundary": {
        "operations": ["list", "search", "get"],
        "exclude_operations": ["create", "update", "delete"]
      },

      "entity_boundary": {
        "entities": ["Service", "Employee", "Task", "Calendar"],
        "categories": ["Settings", "Employee", "Task", "Calendar"]
      },

      "available_tools": ["setting_list", "employee_list", "person_calendar_search"]
    },

    {
      "goal_id": "EXECUTE_SOLUTION",
      "description": "Execute the planned actions",
      "primary_agent": "mcp_agent",

      "tool_boundary": {
        "operations": ["create", "update", "book", "link"],
        "exclude_operations": ["delete", "admin"]
      },

      "entity_boundary": {
        "entities": ["Task", "Calendar", "Customer", "Employee"],
        "categories": ["Task", "Calendar", "Customer", "Linkage", "Workflow"]
      },

      "available_tools": [
        "task_create",
        "task_update",
        "person_calendar_book",
        "customer_update",
        "entity_linkage_create"
      ]
    },

    {
      "goal_id": "CONFIRM_RESOLUTION",
      "description": "Verify satisfaction and close",
      "primary_agent": "conversational_agent",

      "tool_boundary": {
        "operations": ["hangup", "terminate"],
        "exclude_operations": ["create", "update", "delete"]
      },

      "entity_boundary": {
        "entities": ["Chat"],
        "categories": ["Chat", "System"]
      },

      "available_tools": ["call_hangup"]
    }
  ]
}
```

---

## 🔍 Semantic Search Implementation

### Search Algorithm

```typescript
interface ToolBoundary {
  operations: string[];           // ["create", "update", "book"]
  exclude_operations?: string[];  // ["delete", "admin"]
}

interface EntityBoundary {
  entities: string[];              // ["Task", "Calendar", "Customer"]
  categories: string[];            // ["Task", "Calendar", "Customer", "Linkage"]
}

function semanticSearchManifest(
  toolBoundary: ToolBoundary,
  entityBoundary: EntityBoundary
): APIEndpoint[] {
  let results: APIEndpoint[] = [];

  // 1. Filter by category (exact match)
  results = API_MANIFEST.filter(endpoint =>
    entityBoundary.categories.includes(endpoint.category)
  );

  // 2. Filter by operation (semantic match)
  results = results.filter(endpoint => {
    const toolName = endpoint.name.toLowerCase();

    // Check if tool name contains allowed operation
    const hasAllowedOperation = toolBoundary.operations.some(op =>
      toolName.includes(op.toLowerCase())
    );

    // Check if tool name contains excluded operation
    const hasExcludedOperation = toolBoundary.exclude_operations?.some(op =>
      toolName.includes(op.toLowerCase())
    ) || false;

    return hasAllowedOperation && !hasExcludedOperation;
  });

  // 3. Filter by entity (semantic match in description)
  results = results.filter(endpoint => {
    const searchText = `${endpoint.name} ${endpoint.description}`.toLowerCase();

    return entityBoundary.entities.some(entity =>
      searchText.includes(entity.toLowerCase())
    );
  });

  return results;
}
```

### Enhanced Search with Context

```typescript
interface SearchContext {
  extracted_data: {
    customer?: { name: string; phone: string };
    service?: { primary_request: string };
  };
  current_goal: string;
}

function semanticSearchWithContext(
  toolBoundary: ToolBoundary,
  entityBoundary: EntityBoundary,
  context: SearchContext
): APIEndpoint[] {
  // Base search
  let results = semanticSearchManifest(toolBoundary, entityBoundary);

  // Contextual ranking
  results = results.map(endpoint => {
    let score = 1.0;

    // Boost tools related to current intent
    if (context.current_goal === 'EXECUTE_SOLUTION') {
      if (endpoint.name.includes('create')) score *= 1.5;
    }

    // Boost tools related to extracted data
    if (context.extracted_data.customer?.name && endpoint.name.includes('customer')) {
      score *= 1.3;
    }

    return { ...endpoint, relevanceScore: score };
  });

  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Return top N
  return results.slice(0, 20);  // Limit to prevent token overflow
}
```

---

## 🤖 LLM Tool Construction

### Prompt Template

```typescript
function buildToolSelectionPrompt(
  availableTools: APIEndpoint[],
  context: AgentContextState
): string {
  const toolDescriptions = availableTools.map(tool => `
**${tool.name}** (${tool.category})
${tool.description}

Parameters:
${formatParameters(tool.parameters)}
`).join('\n---\n');

  return `
You are executing goal: ${context.context.currentGoal}

Current context:
- Customer: ${context.context.data_extraction_fields.customer.name || 'Unknown'}
- Phone: ${context.context.data_extraction_fields.customer.phone || 'Unknown'}
- Request: ${context.context.data_extraction_fields.service.primary_request || 'Unknown'}
- Solution plan: ${context.context.data_extraction_fields.operations.solution_plan || 'None'}

Available tools for this goal:
${toolDescriptions}

Based on the current context and your task, select the appropriate tool and construct the arguments.

Respond in JSON format:
{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Why this tool was selected"
}
`;
}
```

### Example LLM Response

```json
{
  "tool": "task_create",
  "arguments": {
    "body_name": "Water heater repair - John Doe",
    "body_descr": "Customer reported water heater not working. Customer: John Doe, Phone: 555-1234, Address: 353531 Edmonton Avenue, Palo Alto, CA",
    "body_category": "HVAC_SERVICE",
    "body_priority": "HIGH"
  },
  "reasoning": "Customer has been identified and service request is clear. Creating a task is the next logical step to assign work and track progress."
}
```

---

## 🔄 Integration with Goal Transition

### Goal Execution Flow

```typescript
async function executeGoal(goalId: string, state: AgentContextState) {
  const goal = getGoal(goalId);

  // 1. Get tool scope from goal definition
  const toolBoundary = goal.tool_boundary;
  const entityBoundary = goal.entity_boundary;

  console.log(`[Goal: ${goalId}] Tool boundary: ${JSON.stringify(toolBoundary)}`);
  console.log(`[Goal: ${goalId}] Entity boundary: ${JSON.stringify(entityBoundary)}`);

  // 2. Semantic search on manifest
  const availableTools = semanticSearchWithContext(
    toolBoundary,
    entityBoundary,
    { extracted_data: state.context.data_extraction_fields, current_goal: goalId }
  );

  console.log(`[Goal: ${goalId}] Found ${availableTools.length} relevant tools`);

  // 3. If explicit tools listed, validate they're in search results
  if (goal.available_tools?.length > 0) {
    const missing = goal.available_tools.filter(t =>
      !availableTools.find(tool => tool.name === t)
    );
    if (missing.length > 0) {
      console.warn(`[Goal: ${goalId}] Explicit tools not found in search: ${missing.join(', ')}`);
    }
  }

  // 4. Build LLM prompt
  const prompt = buildToolSelectionPrompt(availableTools, state);

  // 5. LLM selects tool and constructs arguments
  const response = await callLLM({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an MCP tool selector and command builder.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  const toolCall = JSON.parse(response.content);

  console.log(`[Goal: ${goalId}] LLM selected tool: ${toolCall.tool}`);
  console.log(`[Goal: ${goalId}] Reasoning: ${toolCall.reasoning}`);

  // 6. Execute tool
  const result = await executeMCPTool(toolCall.tool, toolCall.arguments, state);

  // 7. Update context with results
  updateContextFromToolResult(state, toolCall.tool, result);

  return result;
}
```

---

## 📊 Comparison Matrix

| Aspect | Dynamic Entity Boundary | Goal-Level Boundaries |
|--------|------------------------|----------------------|
| **Complexity** | High (runtime logic) | Low (declarative config) |
| **Debuggability** | Hard (dynamic) | Easy (explicit in goal) |
| **Maintainability** | Medium (agent profile) | High (goal definition) |
| **Flexibility** | High (context-aware) | Medium (predefined) |
| **Token Efficiency** | Good (category filtering) | Better (semantic search + ranking) |
| **LLM Role** | Function calling | Command construction |
| **Tool Scope** | Agent decides | Goal declares |
| **Configuration** | Agent profile | Goal node |

---

## ✅ Benefits of Goal-Level Approach

1. **Explicit Tool Scope**
   - Each goal declares exactly what tools it needs
   - No guessing or dynamic logic
   - Easy to audit and validate

2. **Semantic Search**
   - Finds tools by operation + entity
   - More flexible than category-only filtering
   - Context-aware ranking

3. **LLM as Command Builder**
   - LLM sees tool descriptions and constructs arguments
   - More natural than function calling
   - Better reasoning (can explain why tool was selected)

4. **Separation of Concerns**
   - Goal = what tools are available
   - LLM = which tool to use and how
   - Agent = execute and handle results

5. **Maintainability**
   - Add new goal = define its boundaries
   - No agent profile changes
   - Self-documenting config

---

## ⚠️ Considerations

### 1. Search Accuracy
**Issue:** Semantic search might miss relevant tools or include irrelevant ones

**Solution:**
- Explicit `available_tools` list in goal as fallback
- Validation: warn if explicit tools not found in search
- Manual curation for critical goals

### 2. LLM Overhead
**Issue:** LLM must construct command (extra LLM call)

**Solution:**
- Use JSON mode for structured output
- Cache common tool constructions
- Use lightweight model (gpt-4o-mini)

### 3. Tool Context Size
**Issue:** Too many tools = token overflow

**Solution:**
- Limit search results to top 20 by relevance
- Summarize tool descriptions
- Use tool embeddings for semantic ranking

### 4. Goal Boundary Redundancy
**Issue:** Multiple goals might have similar boundaries

**Solution:**
- Create reusable boundary templates
- Reference templates in goals
- Share common boundaries

---

## 🚀 Implementation Plan

### Phase 1: Config Structure ⬜
- Add `tool_boundary` and `entity_boundary` to each goal
- Define operations and entity lists
- Validate config at startup

### Phase 2: Semantic Search ⬜
- Implement `semanticSearchManifest()`
- Add operation matching (tool name contains operation)
- Add entity matching (description contains entity)

### Phase 3: LLM Command Builder ⬜
- Create `buildToolSelectionPrompt()`
- Implement LLM call with JSON mode
- Parse and validate LLM response

### Phase 4: Goal Integration ⬜
- Update `executeGoal()` to use boundaries
- Replace `getMCPTools({ categories })` with semantic search
- Test with real conversation flows

### Phase 5: Optimization ⬜
- Add context-aware ranking
- Implement tool description caching
- Add tool usage analytics

---

## 📝 Example: EXECUTE_SOLUTION Goal

### Config
```json
{
  "goal_id": "EXECUTE_SOLUTION",
  "tool_boundary": {
    "operations": ["create", "update", "book", "link"],
    "exclude_operations": ["delete", "admin"]
  },
  "entity_boundary": {
    "entities": ["Task", "Calendar", "Customer"],
    "categories": ["Task", "Calendar", "Customer", "Linkage", "Workflow"]
  },
  "available_tools": ["task_create", "person_calendar_book", "customer_update"]
}
```

### Runtime Behavior
```typescript
// 1. Semantic search finds:
//    - task_create (operation: create, entity: Task)
//    - task_update (operation: update, entity: Task)
//    - person_calendar_book (operation: book, entity: Calendar)
//    - customer_update (operation: update, entity: Customer)
//    - entity_linkage_create (operation: create, entity: Linkage)
//    Total: 5 tools (instead of 1800)

// 2. LLM prompt includes descriptions of these 5 tools

// 3. LLM constructs command:
{
  "tool": "task_create",
  "arguments": {
    "body_name": "Water heater repair",
    "body_descr": "Customer: John Doe\nPhone: 555-1234\n..."
  },
  "reasoning": "Creating task to track service request"
}

// 4. Tool executed, result stored in context
```

---

## 🎯 Recommendation

**Use goal-level boundaries with semantic search** because:
- ✅ More maintainable than dynamic entity boundary
- ✅ Explicit tool scope per goal
- ✅ Semantic search more flexible than category filtering
- ✅ LLM constructs commands with reasoning
- ✅ Self-documenting config

**Implementation Priority:**
1. Start with Phase 1 (config structure)
2. Implement basic semantic search (Phase 2)
3. Test with existing goals
4. Add LLM command builder (Phase 3)
5. Optimize with context-aware ranking (Phase 5)

---

**End of Document**
