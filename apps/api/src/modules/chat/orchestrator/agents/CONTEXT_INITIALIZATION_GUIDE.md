# Context Initialization Guide

## Overview

The orchestrator initializes conversation context using the `global_context_schema` from `agent_config.json`. This ensures all required fields are present from the start and follows the schema definition exactly.

## Architecture

```
┌────────────────────────────────────────────────┐
│  agent_config.json                             │
│  ┌──────────────────────────────────────────┐ │
│  │  global_context_schema                   │ │
│  │  ├─ description                          │ │
│  │  └─ core_keys                            │ │
│  │      ├─ agent_session_id: "string"       │ │
│  │      ├─ customer_name: "string"          │ │
│  │      ├─ customers_main_ask: "mandatory"  │ │
│  │      └─ node_traversal_path: "array"     │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
                    ▼
┌────────────────────────────────────────────────┐
│  context-initializer.service.ts                │
│  - Reads global_context_schema                 │
│  - Parses field types (string, array, object)  │
│  - Identifies mandatory fields                 │
│  - Initializes all fields with correct types   │
│  - Uses node_traversal_path for navigation     │
└────────────────────────────────────────────────┘
                    ▼
┌────────────────────────────────────────────────┐
│  Initial Context Object                        │
│  {                                             │
│    agent_session_id: "uuid",                   │
│    customer_name: "",                          │
│    customers_main_ask: "",  // mandatory       │
│    customer_phone_number: "",  // mandatory    │
│    node_traversal_path: [],                    │
│    summary_of_conversation...: [],             │
│  }                                             │
└────────────────────────────────────────────────┘
```

## Usage in Orchestrator

### 1. Initialize Context at Conversation Start

```typescript
import { createContextInitializer } from './agents/context-initializer.service.js';
import { loadAgentConfig } from './config/loader.js';

// Load agent config
const agentConfig = await loadAgentConfig();

// Create initializer
const contextInitializer = createContextInitializer(agentConfig);

// Start new conversation
async function startConversation(sessionId: string) {
  // Initialize context from schema
  const initialContext = contextInitializer.initializeContext(sessionId, {
    who_are_you: 'You are a polite customer service agent'
  });

  // Save context to file/database
  await saveContext(sessionId, initialContext);

  console.log('Context initialized:', initialContext);
  // Output:
  // {
  //   agent_session_id: "uuid",
  //   who_are_you: "You are a polite customer service agent",
  //   customer_name: "",
  //   customer_phone_number: "",  // mandatory
  //   customer_id: "",
  //   customers_main_ask: "",  // mandatory
  //   matching_service_catalog_to_solve_customers_issue: "",
  //   related_entities_for_customers_ask: "",
  //   task_id: "",
  //   appointment_details: "",
  //   next_course_of_action: "",
  //   next_node_to_go_to: "",
  //   node_traversal_path: [],
  //   summary_of_conversation_on_each_step_until_now: []
  // }
}
```

### 2. Validate Context During Conversation

```typescript
// Before executing a node, validate context
const validation = contextInitializer.validateContext(currentContext);

if (!validation.valid) {
  console.error('Context validation failed:');
  console.error('Missing fields:', validation.missing);
  console.error('Errors:', validation.errors);

  // Handle validation errors
  if (validation.errors.includes("Mandatory field 'customers_main_ask' is empty")) {
    // Route to node that collects customer's main ask
    nextNode = 'ASK_CUSTOMER_ABOUT_THEIR_NEED';
  }
}
```

### 3. Get Field Metadata

```typescript
// Get metadata for a specific field
const metadata = contextInitializer.getFieldMetadata('customers_main_ask');

console.log(metadata);
// Output:
// {
//   type: 'string',
//   mandatory: true,
//   description: 'string (intent, mandatory)'
// }

// Get all mandatory fields
const mandatoryFields = contextInitializer.getMandatoryFields();
console.log('Mandatory fields:', mandatoryFields);
// Output: ['customers_main_ask', 'customer_phone_number']
```

## Field Type Detection

The initializer automatically detects field types from the schema description:

```typescript
// agent_config.json
{
  "global_context_schema": {
    "core_keys": {
      "customer_name": "string",
      "node_traversal_path": "array (contains the nodes...)",
      "retry_count": "number",
      "is_completed": "boolean"
    }
  }
}

// Initialized as:
{
  customer_name: "",              // string → ""
  node_traversal_path: [],        // array → []
  retry_count: 0,                 // number → 0
  is_completed: false             // boolean → false
}
```

## Mandatory Fields Detection

Fields marked as mandatory are detected in two ways:

### Method 1: From graph_config.mandatory_fields

```json
{
  "graph_config": {
    "mandatory_fields": ["customers_main_ask", "customer_phone_number"]
  }
}
```

### Method 2: From field description

```json
{
  "global_context_schema": {
    "core_keys": {
      "customers_main_ask": "string (intent, mandatory)",
      "customer_phone_number": "string (mandatory)"
    }
  }
}
```

Both methods are checked, and fields are marked mandatory if found in either.

## Navigation with node_traversal_path

Navigation is tracked using the `node_traversal_path` array, which records the sequence of nodes visited:

```typescript
{
  node_traversal_path: [
    "GREET_CUSTOMER",
    "ASK_CUSTOMER_ABOUT_THEIR_NEED",
    "Identify_Issue"
  ]
}
```

This array is automatically updated as the conversation progresses through different nodes, providing a complete history of the navigation path.

## Complete Orchestrator Integration

```typescript
// orchestrator.service.ts
import { createContextInitializer } from './agents/context-initializer.service.js';
import { createAgentFactory } from './agents/agent-factory.service.js';
import { loadAgentConfig } from './config/loader.js';

export class OrchestratorService {
  private agentConfig: DAGConfiguration;
  private contextInitializer: ContextInitializer;
  private agentFactory: AgentFactory;

  async initialize() {
    // Load config
    this.agentConfig = await loadAgentConfig();

    // Create initializer
    this.contextInitializer = createContextInitializer(this.agentConfig);

    // Create agent factory
    this.agentFactory = createAgentFactory(this.agentConfig);
  }

  async startConversation(sessionId: string): Promise<string> {
    // Initialize context from schema
    const context = this.contextInitializer.initializeContext(sessionId);

    // Save context
    await this.saveContext(sessionId, context);

    // Execute first node (GREET_CUSTOMER)
    const worker = this.agentFactory.createWorker();
    const result = await worker.execute({
      sessionId,
      context,
      currentNode: this.agentConfig.graph_config.entry_node,
      messages: []
    });

    // Update context
    await this.updateContext(sessionId, result.contextUpdates);

    return result.output.response;
  }

  async processMessage(sessionId: string, userMessage: string): Promise<string> {
    // Load current context
    const state = await this.loadState(sessionId);

    // Validate context before processing
    const validation = this.contextInitializer.validateContext(state.context);
    if (!validation.valid) {
      console.warn('Context validation issues:', validation.errors);
      // Handle validation issues...
    }

    // Use navigator to decide next node
    const navigator = this.agentFactory.createNavigator();
    const decision = await navigator.execute(state);

    // Use worker to execute node
    const worker = this.agentFactory.createWorker();
    const result = await worker.execute(state, {
      userMessage,
      currentNode: decision.output.nextNode
    });

    // Update context
    await this.updateContext(sessionId, result.contextUpdates);

    return result.output.response;
  }
}
```

## Benefits

### 1. Schema-Driven Initialization
- ✅ Context structure defined once in agent_config.json
- ✅ All fields initialized with correct types
- ✅ No hardcoded context structure in code

### 2. Validation
- ✅ Validate context against schema at any time
- ✅ Check mandatory fields are populated
- ✅ Detect missing fields early

### 3. Type Safety
- ✅ Arrays initialized as `[]`, not `""`
- ✅ Objects initialized as `{}`, not `null`
- ✅ Consistent types throughout conversation

### 4. Maintainability
- ✅ Change schema in one place (agent_config.json)
- ✅ Context automatically reflects schema changes
- ✅ No code changes needed for new fields

## Example: Adding New Field

### 1. Add to Schema

```json
{
  "global_context_schema": {
    "core_keys": {
      "customer_email": "string (email address, optional)",
      "conversation_tags": "array (tags for conversation categorization)"
    }
  }
}
```

### 2. Context Automatically Includes New Fields

```typescript
// No code changes needed!
const context = contextInitializer.initializeContext(sessionId);

console.log(context.customer_email);      // ""
console.log(context.conversation_tags);   // []
```

## Debugging

Enable detailed logging:

```typescript
// Logs show:
// [ContextInitializer] 🔧 Initializing FRESH context for session: abc123...
// [ContextInitializer] 🚮 Flushing dummy data from schema...
// [ContextInitializer] ⚠️  customers_main_ask is MANDATORY
// [ContextInitializer] ⚠️  customer_phone_number is MANDATORY
// [ContextInitializer] ✅ Context initialized:
//    - Total fields: 13
//    - Mandatory fields: 2 (customers_main_ask, customer_phone_number)
//    - Arrays: 2
// [ContextInitializer] ✅ Fresh context initialized (dummy data flushed)
```

## Summary

The Context Initializer service:

1. ✅ Reads `global_context_schema` from agent_config.json
2. ✅ Flushes dummy/example data and creates fresh empty context
3. ✅ Parses field types (string, array, object, number, boolean)
4. ✅ Identifies mandatory fields
5. ✅ Initializes all fields with appropriate empty values
6. ✅ Uses `node_traversal_path` array for navigation tracking
7. ✅ Validates context against schema
8. ✅ Provides field metadata

**Result:** Schema-driven context initialization that's maintainable and type-safe!
