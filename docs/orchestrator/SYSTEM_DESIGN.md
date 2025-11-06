# Orchestrator System Design - End-to-End Plumbing

**Version:** 2.0.0 | **Status:** Production | **Updated:** 2025-11-06

> **Complete technical reference for understanding the orchestrator's internal architecture, data flows, and component interactions**

---

## Table of Contents

1. [Complete System Architecture](#complete-system-architecture)
2. [End-to-End Request Flow](#end-to-end-request-flow)
3. [Component Deep Dive](#component-deep-dive)
4. [State Management Plumbing](#state-management-plumbing)
5. [MCP Tool Execution Flow](#mcp-tool-execution-flow)
6. [Database Persistence Layer](#database-persistence-layer)
7. [Error Handling and Retry Logic](#error-handling-and-retry-logic)
8. [Authentication Flow](#authentication-flow)
9. [Session Lifecycle](#session-lifecycle)
10. [Performance Optimizations](#performance-optimizations)

---

## Complete System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ React 19 Frontend (ChatWidget.tsx)                               │  │
│  │  - User input handling                                           │  │
│  │  - Session management                                            │  │
│  │  - Response rendering                                            │  │
│  │  - Engaging message display                                      │  │
│  └──────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │ HTTP POST /api/v1/chat/langgraph/message
                          │ Headers: { Authorization: Bearer JWT }
                          │ Body: { session_id?, message, chat_session_id?, user_id? }
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTIFY API LAYER                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Route Handler (langgraph-orchestrator.routes.ts)                │  │
│  │  1. Extract request body (message, session_id, etc.)            │  │
│  │  2. Extract JWT token from Authorization header                 │  │
│  │  3. Call orchestrator.processMessage()                          │  │
│  │  4. Return response JSON                                        │  │
│  └──────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LANGGRAPH ORCHESTRATOR SERVICE                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ LangGraphOrchestratorService (langgraph-orchestrator.service.ts)│  │
│  │  1. Detect intent (new session) or resume (existing session)    │  │
│  │  2. Get/create initial state                                    │  │
│  │  3. Extract data from user message (NLP)                        │  │
│  │  4. Load appropriate LangGraph StateGraph                       │  │
│  │  5. Invoke graph with state                                     │  │
│  │  6. Save checkpoint via PostgresCheckpointer                    │  │
│  │  7. Return response                                             │  │
│  └──────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LANGGRAPH STATEGRAPH                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ CalendarBooking Graph (calendar-booking.langgraph.ts)           │  │
│  │                                                                  │  │
│  │  START                                                           │  │
│  │    ↓                                                             │  │
│  │  [entry] ────────────────────────────────────────────────┐      │  │
│  │    ↓                                                      │      │  │
│  │  [critic] ← Check boundaries, off-topic, max turns       │      │  │
│  │    ↓                                                      │      │  │
│  │  [identify_customer] ← Search/collect customer info      │      │  │
│  │    ↓                   ↓                                  │      │  │
│  │    ├─ Existing ──→ [welcome_existing]                    │      │  │
│  │    │                  ↓                                   │      │  │
│  │    └─ New ──────→ [create_customer] ← MCP: customer_create     │  │
│  │                       ↓                                   │      │  │
│  │                  [gather_booking_requirements]            │      │  │
│  │                       ↓                                   │      │  │
│  │                  [find_available_slots] ← MCP: employee_list    │  │
│  │                       ↓                                   │      │  │
│  │                  [propose_options]                        │      │  │
│  │                       ↓                                   │      │  │
│  │                  [create_booking] ← MCP: task_create + linkage  │  │
│  │                       ↓                                   │      │  │
│  │                  [confirm_and_summarize]                  │      │  │
│  │                       ↓                                   │      │  │
│  │                     END                                   │      │  │
│  │                                                                  │  │
│  │  Each node:                                                      │  │
│  │    - Receives OrchestratorState                                 │  │
│  │    - Executes logic (data collection, MCP calls, validation)    │  │
│  │    - Returns StateUpdate (partial state changes)                │  │
│  │    - Routing determined by routeNextNode() conditional edges    │  │
│  └──────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
                          ├────────────────────────────────────────────┐
                          │                                            │
                          ▼                                            ▼
┌──────────────────────────────────────────┐  ┌─────────────────────────────────┐
│       MCP ADAPTER SERVICE                │  │  POSTGRESQL CHECKPOINTER        │
│  ┌────────────────────────────────────┐  │  │  ┌───────────────────────────┐  │
│  │ MCPAdapterService                  │  │  │  │ PostgresCheckpointer      │  │
│  │  (mcp-adapter.service.ts)          │  │  │  │  (postgres-checkpointer.ts│  │
│  │                                    │  │  │  │                           │  │
│  │  executeMCPTool(name, args, jwt)   │  │  │  │  put() - Save checkpoint  │  │
│  │    ↓                               │  │  │  │  get() - Load checkpoint  │  │
│  │  1. Filter tool (50/126 allowed)  │  │  │  │  list() - List checkpoints│  │
│  │  2. Prepare request                │  │  │  └───────────┬───────────────┘  │
│  │  3. POST /api/mcp/execute/:tool    │  │  │              │                  │
│  │  4. Include JWT in headers         │  │  │              ▼                  │
│  │  5. Return result                  │  │  │  ┌───────────────────────────┐  │
│  └────────────┬───────────────────────┘  │  │  │ StateManagerService       │  │
└───────────────┼──────────────────────────┘  │  │  (state-manager.service.ts│  │
                │                              │  │                           │  │
                ▼                              │  │  - createSession()        │  │
┌──────────────────────────────────────────┐  │  │  - getSession()           │  │
│         MCP SERVER                       │  │  │  - setState()             │  │
│  ┌────────────────────────────────────┐  │  │  │  - getAllState()          │  │
│  │ MCP Manifest (126 API tools)       │  │  │  │  - logAgentAction()       │  │
│  │  - customer_create                 │  │  │  │  - saveSummary()          │  │
│  │  - customer_list                   │  │  │  └───────────┬───────────────┘  │
│  │  - task_create                     │  │  └──────────────┼──────────────────┘
│  │  - linkage_create                  │  │                 │
│  │  - employee_list                   │  │                 ▼
│  │  - ...                             │  │  ┌──────────────────────────────────┐
│  │                                    │  │  │      POSTGRESQL DATABASE         │
│  │  Each tool maps to API endpoint:  │  │  │  ┌────────────────────────────┐  │
│  │  POST /api/v1/:entity/:action      │  │  │  │ orchestrator_session      │  │
│  │  With RBAC enforcement             │  │  │  │  - session metadata       │  │
│  └────────────┬───────────────────────┘  │  │  │  - current_intent/node    │  │
└───────────────┼──────────────────────────┘  │  │  - status, timestamps     │  │
                │                              │  └────────────┬───────────────┘  │
                ▼                              │  ┌────────────────────────────┐  │
┌──────────────────────────────────────────┐  │  │ orchestrator_state        │  │
│       ENTITY API MODULES                 │  │  │  - key-value pairs        │  │
│  ┌────────────────────────────────────┐  │  │  │  - customer_name, etc     │  │
│  │ 31+ Entity-based API Modules       │  │  │  │  - source, validated flag │  │
│  │                                    │  │  │  └────────────┬───────────────┘  │
│  │ Customer Module (cust/routes.ts)   │  │  │  ┌────────────────────────────┐  │
│  │  POST /api/v1/customer/create      │  │  │  │ orchestrator_agent_log    │  │
│  │  GET  /api/v1/customer/list        │  │  │  │  - agent actions          │  │
│  │                                    │  │  │  │  - MCP tool calls         │  │
│  │ Task Module (task/routes.ts)       │  │  │  │  - success/error logs     │  │
│  │  POST /api/v1/task/create          │  │  │  └────────────┬───────────────┘  │
│  │                                    │  │  │  ┌────────────────────────────┐  │
│  │ Employee Module (employee/routes)  │  │  │  │ orchestrator_summary      │  │
│  │  GET  /api/v1/employee/list        │  │  │  │  - LLM-generated summaries│  │
│  │                                    │  │  │  │  - conversation context   │  │
│  │ Linkage Module (linkage/index.ts) │  │  │  └───────────────────────────┘  │
│  │  POST /api/v1/linkage/create       │  │  │                                  │
│  │                                    │  │  │  ┌────────────────────────────┐  │
│  │ All with:                          │  │  │  │ Entity Tables (52 total)  │  │
│  │  - JWT authentication              │  │  │  │  - d_customer             │  │
│  │  - RBAC permission checks          │  │  │  │  - d_task                 │  │
│  │  - Entity-based authorization      │  │  │  │  - d_employee             │  │
│  │  - Audit logging                   │  │  │  │  - d_entity_id_map        │  │
│  └────────────┬───────────────────────┘  │  │  │  - ...                    │  │
└───────────────┼──────────────────────────┘  │  └───────────────────────────┘  │
                │                              └──────────────────────────────────┘
                ▼
┌──────────────────────────────────────────┐
│      POSTGRESQL DATABASE                 │
│  ┌────────────────────────────────────┐  │
│  │ 52 Entity and Settings Tables      │  │
│  │  - d_customer                      │  │
│  │  - d_task                          │  │
│  │  - d_employee                      │  │
│  │  - d_entity_id_map (linkages)      │  │
│  │  - f_customer_interaction          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## End-to-End Request Flow

### Detailed Step-by-Step Flow

#### Phase 1: Request Initiation (Client → API)

```
USER ACTION: Types "I need landscaping service" in chat widget

FRONTEND (ChatWidget.tsx):
  1. Capture user input from textarea
  2. Check for existing sessionId in React state
  3. Construct request payload:
     {
       session_id: existingSessionId || undefined,
       message: "I need landscaping service",
       chat_session_id: currentChatSessionId,
       user_id: authenticatedUserId
     }
  4. Get JWT token from auth context
  5. Dispatch fetch request:
     POST /api/v1/chat/langgraph/message
     Headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
     }
  6. Show loading indicator
  7. If engaging message in response, display it
```

#### Phase 2: API Gateway (Fastify → Route Handler)

```
FASTIFY SERVER (server.ts):
  1. Receive HTTP POST request
  2. CORS validation (check origin)
  3. Rate limiting check (100 req/min)
  4. Helmet security headers
  5. Route to /api/v1/chat/langgraph/message

ROUTE HANDLER (langgraph-orchestrator.routes.ts):
  1. Extract request.body:
     - session_id (optional UUID)
     - message (required string)
     - chat_session_id (optional UUID)
     - user_id (optional UUID)
  2. Validate: message must be non-empty
  3. Extract JWT: request.headers.authorization?.replace('Bearer ', '')
  4. Call orchestrator:
     const result = await orchestrator.processMessage({
       sessionId: session_id,
       message,
       chatSessionId: chat_session_id,
       userId: user_id,
       authToken: jwt
     });
  5. Return result as JSON (200) or error (400/500)
```

#### Phase 3: Orchestrator Service (Intent Detection & State Management)

```
LANGGRAPH ORCHESTRATOR SERVICE (langgraph-orchestrator.service.ts):

processMessage() {

  // Step 1: Intent Detection
  if (!sessionId) {
    intent = await detectIntent(message);
    // "landscaping service" → matches "landscaping" keyword → "CalendarBooking"
    sessionId = uuidv4(); // Generate new session ID
  } else {
    session = await stateManager.getSession(sessionId);
    intent = session.current_intent; // Resume existing intent
  }

  // Step 2: Load Graph
  graph = this.graphs.get(intent);
  // Returns compiled LangGraph StateGraph for CalendarBooking

  // Step 3: Get or Create State
  existingCheckpoint = await checkpointer.get({
    configurable: { thread_id: sessionId }
  });

  if (existingCheckpoint) {
    // RESUME: Existing session
    currentState = existingCheckpoint.checkpoint.channel_values;
    currentState.userMessage = message;
    currentState.turnCount += 1;
    currentState.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
      nodeContext: currentState.currentNode
    });
  } else {
    // NEW: Create initial state
    currentState = {
      sessionId,
      chatSessionId,
      userId,
      currentIntent: intent,
      currentNode: 'entry',
      status: 'active',
      variables: {},
      messages: [{ role: 'user', content: message, timestamp: new Date() }],
      agentActions: [],
      userMessage: message,
      requiresUserInput: false,
      completed: false,
      conversationEnded: false,
      offTopicCount: 0,
      turnCount: 1,
      authToken,
      metadata: {
        startTime: new Date(),
        lastUpdateTime: new Date(),
        totalAgentCalls: 0,
        totalMcpCalls: 0
      }
    };
  }

  // Step 4: Extract Data from Message
  currentState = await extractDataFromMessage(currentState);
  // Uses regex to extract:
  //  - phone: (\d{3}[-.\s]?\d{3}[-.\s]?\d{4})
  //  - email: ([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)
  //  - name: "I'm X" or "My name is X"
  //  - service: "landscaping" → updates variables.service_category

  // Step 5: Invoke Graph
  result = await graph.invoke(currentState, {
    configurable: { thread_id: sessionId }
  });
  // Graph executes nodes, updates state, returns final state

  // Step 6: Save Checkpoint
  await checkpointer.put(
    { configurable: { thread_id: sessionId } },
    {
      v: 1,
      id: uuidv4(),
      ts: new Date().toISOString(),
      channel_values: result,
      channel_versions: {},
      versions_seen: {}
    },
    {}
  );

  // Step 7: Return Response
  return {
    sessionId,
    response: result.naturalResponse || 'Processing...',
    intent: result.currentIntent,
    currentNode: result.currentNode,
    requiresUserInput: result.requiresUserInput,
    completed: result.completed,
    conversationEnded: result.conversationEnded,
    endReason: result.endReason,
    engagingMessage: result.engagingMessage
  };
}
```

#### Phase 4: LangGraph Execution (StateGraph Nodes)

```
LANGGRAPH STATEGRAPH (calendar-booking.langgraph.ts):

graph.invoke(currentState) {

  // Node 1: Entry
  START → entryNode(state)
    → Returns: { currentNode: 'entry', status: 'active', turnCount: 2 }

  // Routing: routeNextNode(state)
  if (state.currentNode === 'entry') return 'critic';

  // Node 2: Critic
  criticNode(state) {
    userMessage = state.userMessage.toLowerCase();
    // Check forbidden topics
    if (userMessage.includes('weather')) {
      state.offTopicCount += 1;
      if (state.offTopicCount >= 2) {
        return {
          conversationEnded: true,
          endReason: 'off_topic',
          naturalResponse: "I'm designed for service bookings only."
        };
      }
      return {
        offTopicCount: state.offTopicCount,
        naturalResponse: "Let's focus on scheduling your service.",
        requiresUserInput: true
      };
    }
    // Check max turns
    if (state.turnCount > 20) {
      return { conversationEnded: true, endReason: 'max_turns' };
    }
    // Pass through
    return {};
  }

  // Routing: routeNextNode(state)
  if (state.currentNode === 'critic') return 'identify_customer';

  // Node 3: Identify Customer
  identifyCustomerNode(state, mcpAdapter) {
    // Check if we have customer info
    if (!state.variables.customer_name || !state.variables.customer_phone) {
      return {
        currentNode: 'identify_customer',
        naturalResponse: "Can I get your name and phone number?",
        requiresUserInput: true
      };
    }

    // Search for existing customer
    try {
      mcpResult = await mcpAdapter.executeMCPTool('customer_list', {
        phone: state.variables.customer_phone
      }, state.authToken);

      customers = mcpResult?.customers || [];

      if (customers.length > 0) {
        // Existing customer
        customer = customers[0];
        return {
          variables: {
            customer_id: customer.id,
            customer_name: customer.name,
            customer_email: customer.primary_email,
            is_new_customer: false
          },
          metadata: { totalMcpCalls: state.metadata.totalMcpCalls + 1 }
        };
      } else {
        // New customer
        return {
          variables: { is_new_customer: true },
          metadata: { totalMcpCalls: state.metadata.totalMcpCalls + 1 }
        };
      }
    } catch (error) {
      return {
        error: { code: 'MCP_CALL_FAILED', message: error.message },
        naturalResponse: "Let me try again."
      };
    }
  }

  // Routing: routeNextNode(state)
  if (state.variables.customer_id) return 'welcome_existing';
  else return 'create_customer';

  // Node 4: Create Customer (if new)
  createCustomerNode(state, mcpAdapter) {
    if (!state.variables.customer_address) {
      return {
        naturalResponse: "What's your service address?",
        requiresUserInput: true
      };
    }

    mcpResult = await mcpAdapter.executeMCPTool('customer_create', {
      body_name: state.variables.customer_name,
      body_primary_phone: state.variables.customer_phone,
      body_primary_address: state.variables.customer_address,
      body_city: state.variables.customer_city,
      body_province: 'ON',
      body_country: 'Canada'
    }, state.authToken);

    return {
      variables: {
        customer_id: mcpResult.id,
        customer_code: mcpResult.code
      },
      naturalResponse: "Perfect! Now let's schedule your service.",
      metadata: { totalMcpCalls: state.metadata.totalMcpCalls + 1 }
    };
  }

  // ... continues through all nodes until END or requiresUserInput

  // Final state after all nodes executed
  return finalState;
}
```

#### Phase 5: MCP Tool Execution (Deep Dive)

```
MCP ADAPTER (mcp-adapter.service.ts):

executeMCPTool(toolName, args, authToken) {

  // Step 1: Validate tool
  allowedTools = [
    'customer_list', 'customer_create', 'task_create',
    'employee_list', 'linkage_create', ...
  ];
  if (!allowedTools.includes(toolName)) {
    throw new Error(`Tool ${toolName} not allowed`);
  }

  // Step 2: Map tool to API endpoint
  const toolMapping = {
    'customer_list': { method: 'GET', path: '/api/v1/customer/list' },
    'customer_create': { method: 'POST', path: '/api/v1/customer/create' },
    'task_create': { method: 'POST', path: '/api/v1/task/create' },
    'employee_list': { method: 'GET', path: '/api/v1/employee/list' },
    'linkage_create': { method: 'POST', path: '/api/v1/linkage/create' }
  };

  endpoint = toolMapping[toolName];

  // Step 3: Construct request
  requestConfig = {
    method: endpoint.method,
    url: `${config.API_BASE_URL}${endpoint.path}`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (endpoint.method === 'GET') {
    // Query parameters
    requestConfig.params = args; // { phone: '1234567890' }
  } else {
    // Request body
    requestConfig.data = args; // { body_name: 'John', body_phone: '...' }
  }

  // Step 4: Execute HTTP request
  response = await axios(requestConfig);

  // Step 5: Return result
  return response.data; // { customers: [...] } or { id: 'uuid', code: 'CUST-001' }
}
```

#### Phase 6: Entity API Execution (Customer Create Example)

```
ENTITY API (cust/routes.ts):

POST /api/v1/customer/create

Handler:
  1. JWT Verification:
     token = request.headers.authorization?.replace('Bearer ', '');
     decoded = jwt.verify(token, config.JWT_SECRET);
     // decoded = { sub: userId, email, roles, permissions }

  2. RBAC Check:
     hasPermission = await checkEntityPermission(
       userId: decoded.sub,
       entityType: 'customer',
       action: 'create',
       entityId: null // New entity
     );
     if (!hasPermission) {
       return reply.code(403).send({ error: 'Forbidden' });
     }

  3. Input Validation:
     const { body_name, body_primary_phone, body_primary_address, body_city } = request.body;
     if (!body_name || !body_primary_phone) {
       return reply.code(400).send({ error: 'Name and phone required' });
     }

  4. Database Insert:
     customerId = uuidv4();
     customerCode = await generateCode('CUST');

     await db.insert(d_customer).values({
       id: customerId,
       code: customerCode,
       name: body_name,
       primary_phone: body_primary_phone,
       primary_address: body_primary_address,
       city: body_city,
       province: body_province || 'ON',
       country: body_country || 'Canada',
       created_by: decoded.sub,
       created_ts: new Date()
     });

  5. RBAC Record:
     await db.insert(entity_id_rbac_map).values({
       entity_type: 'customer',
       entity_id: customerId,
       user_id: decoded.sub,
       permission: 'owner'
     });

  6. Audit Log:
     await db.insert(audit_log).values({
       user_id: decoded.sub,
       action: 'customer_create',
       entity_type: 'customer',
       entity_id: customerId,
       timestamp: new Date()
     });

  7. Return Response:
     return reply.code(201).send({
       id: customerId,
       code: customerCode,
       name: body_name,
       primary_email: body_primary_email,
       primary_address: body_primary_address
     });
```

#### Phase 7: State Persistence (Checkpoint Save)

```
POSTGRESQL CHECKPOINTER (postgres-checkpointer.ts):

put(config, checkpoint, metadata) {

  threadId = config.configurable.thread_id; // sessionId
  state = checkpoint.channel_values; // OrchestratorState

  // Step 1: Check if session exists
  session = await stateManager.getSession(threadId);

  if (!session) {
    // CREATE NEW SESSION
    session = await stateManager.createSession({
      session_id: threadId,
      chat_session_id: state.chatSessionId,
      user_id: state.userId,
      current_intent: state.currentIntent,
      current_node: state.currentNode,
      status: state.status
    });

    // INSERT INTO orchestrator_session
    await db.insert(orchestrator_session).values({
      id: threadId,
      session_number: `ORCH-${format(new Date(), 'yyyyMMdd')}-${sequence}`,
      chat_session_id: state.chatSessionId,
      user_id: state.userId,
      current_intent: state.currentIntent,
      current_node: state.currentNode,
      status: state.status,
      session_context: {},
      total_agent_calls: 0,
      total_mcp_calls: 0,
      created_ts: new Date()
    });
  } else {
    // UPDATE EXISTING SESSION
    await stateManager.updateSession(threadId, {
      current_node: state.currentNode,
      status: state.status,
      session_context: {
        completed: state.completed,
        conversationEnded: state.conversationEnded,
        endReason: state.endReason,
        turnCount: state.turnCount,
        offTopicCount: state.offTopicCount
      }
    });

    // UPDATE orchestrator_session
    await db.update(orchestrator_session)
      .set({
        current_node: state.currentNode,
        status: state.status,
        session_context: sqlJsonb(sessionContext),
        total_agent_calls: state.metadata.totalAgentCalls,
        total_mcp_calls: state.metadata.totalMcpCalls,
        updated_ts: new Date()
      })
      .where(eq(orchestrator_session.id, threadId));
  }

  // Step 2: Save all state variables
  for (const [key, value] of Object.entries(state.variables)) {
    await stateManager.setState(threadId, key, value, {
      source: 'langgraph_checkpoint',
      node_context: state.currentNode,
      validated: true
    });

    // UPSERT INTO orchestrator_state
    await db.insert(orchestrator_state).values({
      id: uuidv4(),
      session_id: threadId,
      key: key,
      value: sqlJsonb(value),
      source: 'langgraph_checkpoint',
      node_context: state.currentNode,
      validated: true,
      created_ts: new Date()
    })
    .onConflictDoUpdate({
      target: [orchestrator_state.session_id, orchestrator_state.key],
      set: {
        value: sqlJsonb(value),
        node_context: state.currentNode,
        updated_ts: new Date()
      }
    });
  }

  // Step 3: Save checkpoint metadata
  await stateManager.setState(threadId, '_checkpoint_metadata', {
    checkpoint_id: checkpoint.id,
    metadata,
    timestamp: new Date().toISOString()
  });

  return {
    configurable: {
      thread_id: threadId,
      checkpoint_id: checkpoint.id
    }
  };
}
```

#### Phase 8: Response Journey (API → Client)

```
RESPONSE PATH:

ORCHESTRATOR SERVICE:
  Returns: {
    sessionId: 'uuid-123',
    response: "Hi! I'd be happy to help you schedule a landscaping service. Can I get your name and phone number?",
    intent: 'CalendarBooking',
    currentNode: 'identify_customer',
    requiresUserInput: true,
    completed: false,
    conversationEnded: false,
    engagingMessage: undefined
  }
  ↓

ROUTE HANDLER:
  return reply.code(200).send(result);
  ↓

FASTIFY:
  Serializes JSON
  Sets headers: Content-Type: application/json
  ↓

HTTP RESPONSE:
  Status: 200 OK
  Body: {
    "sessionId": "uuid-123",
    "response": "Hi! I'd be happy to help...",
    "intent": "CalendarBooking",
    "currentNode": "identify_customer",
    "requiresUserInput": true,
    "completed": false,
    "conversationEnded": false
  }
  ↓

FRONTEND (ChatWidget.tsx):
  1. Receive response
  2. Hide loading indicator
  3. Store sessionId in React state
  4. Append assistant message to conversation:
     setMessages(prev => [...prev, {
       role: 'assistant',
       content: response.response,
       timestamp: new Date()
     }]);
  5. If engagingMessage exists, show it briefly
  6. If requiresUserInput === true, enable input field
  7. If conversationEnded === true, disable input and show end message
  8. Scroll to bottom of chat
  ↓

USER SEES:
  "Hi! I'd be happy to help you schedule a landscaping service.
   Can I get your name and phone number?"
```

---

## Component Deep Dive

### LangGraph StateGraph Compilation

```typescript
// How LangGraph compiles the graph

const graph = new StateGraph(OrchestratorStateAnnotation)
  .addNode('entry', entryNode)         // Register node function
  .addNode('critic', criticNode)
  .addNode('identify_customer', identifyCustomerNode)
  // ... more nodes
  .addEdge(START, 'entry')            // START → entry (unconditional)
  .addConditionalEdges('entry', routeNextNode)  // entry → ? (conditional)
  .addConditionalEdges('critic', routeNextNode)
  // ... more edges

const compiledGraph = graph.compile();

// Compiled graph structure:
{
  nodes: Map {
    'entry' => entryNode,
    'critic' => criticNode,
    'identify_customer' => identifyCustomerNode,
    ...
  },
  edges: Map {
    START => ['entry'],
    'entry' => [routeNextNode],
    'critic' => [routeNextNode],
    ...
  },
  invoke: async (state, config) => {
    // Execution loop
    currentNode = START;
    while (currentNode !== END) {
      // Execute node
      nodeFunction = nodes.get(currentNode);
      stateUpdate = await nodeFunction(state);

      // Merge state
      state = mergeState(state, stateUpdate);

      // Determine next node
      edges = edges.get(currentNode);
      if (typeof edges === 'function') {
        currentNode = edges(state); // Conditional routing
      } else {
        currentNode = edges[0]; // Unconditional edge
      }

      // Check for termination
      if (state.conversationEnded || state.completed) {
        currentNode = END;
      }
    }
    return state;
  }
}
```

### State Annotation and Reducers

```typescript
// How LangGraph merges state updates

export const OrchestratorStateAnnotation = Annotation.Root({
  // Simple fields - last write wins
  sessionId: Annotation<string>(),
  currentNode: Annotation<string>(),

  // Reducer fields - custom merge logic
  variables: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update }),
    // MERGE STRATEGY: Object.assign behavior
    // current: { name: 'John' }
    // update:  { phone: '123' }
    // result:  { name: 'John', phone: '123' }
  }),

  messages: Annotation<ConversationMessage[]>({
    reducer: (current, update) => [...current, ...update],
    // APPEND STRATEGY: Concatenate arrays
    // current: [msg1, msg2]
    // update:  [msg3]
    // result:  [msg1, msg2, msg3]
  }),

  agentActions: Annotation<AgentAction[]>({
    reducer: (current, update) => [...current, ...update],
    // APPEND STRATEGY: Audit trail grows
  }),

  metadata: Annotation<Metadata>({
    reducer: (current, update) => ({ ...current, ...update }),
    // MERGE STRATEGY: Update specific metadata fields
  }),
});

// Example state update flow:
initialState = {
  sessionId: 'uuid-123',
  currentNode: 'entry',
  variables: { service_category: 'Landscaping' },
  messages: [{ role: 'user', content: 'I need service' }],
  agentActions: [],
  metadata: { totalMcpCalls: 0 }
};

nodeUpdate = {
  currentNode: 'identify_customer',
  variables: { customer_name: 'John' },
  messages: [{ role: 'assistant', content: 'Can I get your phone?' }],
  metadata: { totalMcpCalls: 1 }
};

mergedState = {
  sessionId: 'uuid-123',  // Unchanged
  currentNode: 'identify_customer',  // Updated
  variables: {
    service_category: 'Landscaping',  // Preserved
    customer_name: 'John'             // Added
  },
  messages: [
    { role: 'user', content: 'I need service' },
    { role: 'assistant', content: 'Can I get your phone?' }
  ],
  agentActions: [],  // No updates
  metadata: {
    totalMcpCalls: 1  // Updated
  }
};
```

---

## State Management Plumbing

### Session Lifecycle Database Interactions

```sql
-- Session Creation (First Message)

-- 1. Insert session
INSERT INTO orchestrator_session (
  id, session_number, chat_session_id, user_id,
  current_intent, current_node, status,
  session_context, total_agent_calls, total_mcp_calls,
  created_ts
) VALUES (
  'uuid-123',
  'ORCH-20251106-0001',
  'chat-uuid-456',
  'user-uuid-789',
  'CalendarBooking',
  'entry',
  'active',
  '{}',
  0,
  0,
  NOW()
);

-- 2. Insert initial state variables (as they're collected)
INSERT INTO orchestrator_state (
  id, session_id, key, value,
  source, node_context, validated,
  created_ts
) VALUES
  ('state-uuid-1', 'uuid-123', 'service_category', '"Landscaping"', 'user_input', 'entry', true, NOW()),
  ('state-uuid-2', 'uuid-123', 'customer_name', '"John"', 'user_input', 'identify_customer', false, NOW()),
  ('state-uuid-3', 'uuid-123', 'customer_phone', '"1234567890"', 'user_input', 'identify_customer', false, NOW());

-- 3. Log agent action (after MCP call)
INSERT INTO orchestrator_agent_log (
  id, session_id, agent_role, agent_action,
  node_context, mcp_tool_name, mcp_tool_args,
  mcp_tool_result, success, duration_ms,
  created_ts
) VALUES (
  'log-uuid-1',
  'uuid-123',
  'worker',
  'mcp_call',
  'identify_customer',
  'customer_list',
  '{"phone": "1234567890"}',
  '{"customers": [{"id": "cust-uuid", "name": "John Doe"}]}',
  true,
  145,
  NOW()
);

-- Session Update (Subsequent Messages)

-- 1. Update session
UPDATE orchestrator_session
SET
  current_node = 'create_booking',
  session_context = '{"turnCount": 5, "offTopicCount": 0, "completed": false}',
  total_agent_calls = 8,
  total_mcp_calls = 3,
  updated_ts = NOW()
WHERE id = 'uuid-123';

-- 2. Upsert state variables
INSERT INTO orchestrator_state (id, session_id, key, value, node_context, updated_ts)
VALUES ('new-uuid', 'uuid-123', 'selected_time', '"9:00 AM"', 'propose_options', NOW())
ON CONFLICT (session_id, key)
DO UPDATE SET
  value = EXCLUDED.value,
  node_context = EXCLUDED.node_context,
  updated_ts = NOW();

-- Session Completion

UPDATE orchestrator_session
SET
  status = 'completed',
  session_context = '{"completed": true, "conversationEnded": true, "endReason": "completed"}',
  updated_ts = NOW()
WHERE id = 'uuid-123';

-- Save summary
INSERT INTO orchestrator_summary (
  id, session_id, summary_type, summary_text,
  up_to_node, message_count, created_ts
) VALUES (
  'summary-uuid',
  'uuid-123',
  'full',
  'Customer John scheduled landscaping service for 2025-11-15 at 9:00 AM. Booking #TASK-001 created.',
  'confirm_and_summarize',
  10,
  NOW()
);
```

### State Recovery (Session Resume)

```typescript
// User returns after closing browser

// Frontend sends existing sessionId
POST /api/v1/chat/langgraph/message
{
  "session_id": "uuid-123",  // Existing session
  "message": "Actually, can we change the time to 2 PM?"
}

// Backend: Load checkpoint
async get(config) {
  threadId = config.configurable.thread_id; // "uuid-123"

  // 1. Load session
  session = await db
    .select()
    .from(orchestrator_session)
    .where(eq(orchestrator_session.id, threadId))
    .limit(1);

  if (!session) return undefined;

  // 2. Load all state variables
  stateVars = await db
    .select()
    .from(orchestrator_state)
    .where(eq(orchestrator_state.session_id, threadId));

  // 3. Reconstruct state
  reconstructedState = {
    sessionId: session.id,
    currentIntent: session.current_intent,
    currentNode: session.current_node,
    status: session.status,
    variables: {},
    completed: session.session_context?.completed || false,
    conversationEnded: session.session_context?.conversationEnded || false,
    turnCount: session.session_context?.turnCount || 0,
    offTopicCount: session.session_context?.offTopicCount || 0,
    // ... other fields
  };

  // 4. Populate variables from database
  stateVars.forEach(stateVar => {
    if (stateVar.key !== '_checkpoint_metadata') {
      reconstructedState.variables[stateVar.key] = stateVar.value;
    }
  });

  // Now the graph can resume from current_node with full context
  return { checkpoint: { channel_values: reconstructedState } };
}
```

---

## MCP Tool Execution Flow

### Complete MCP Call Lifecycle

```
NODE REQUESTS MCP CALL:
  await mcpAdapter.executeMCPTool('customer_create', {
    body_name: 'John Doe',
    body_primary_phone: '1234567890'
  }, authToken);
  ↓

MCP ADAPTER VALIDATION:
  1. Check if tool is in allowedTools[]
  2. Map tool name to API endpoint
  3. Prepare HTTP request
  ↓

HTTP REQUEST TO MCP SERVER:
  POST http://localhost:4000/api/mcp/execute/customer_create
  Headers:
    Authorization: Bearer eyJhbGc...
    Content-Type: application/json
  Body:
    {
      "body_name": "John Doe",
      "body_primary_phone": "1234567890"
    }
  ↓

MCP SERVER ROUTING:
  1. Extract tool name from URL path
  2. Look up tool definition in manifest
  3. Map to Entity API endpoint:
     customer_create → POST /api/v1/customer/create
  4. Forward request with auth token
  ↓

ENTITY API (CUSTOMER MODULE):
  1. JWT verification
  2. RBAC check (user has customer:create permission?)
  3. Input validation
  4. Database insert
  5. RBAC record creation
  6. Audit log
  7. Return response
  ↓

MCP SERVER RESPONSE:
  Returns:
  {
    "id": "cust-uuid-789",
    "code": "CUST-001",
    "name": "John Doe",
    "primary_phone": "1234567890"
  }
  ↓

MCP ADAPTER RETURNS:
  result = {
    id: "cust-uuid-789",
    code: "CUST-001",
    name: "John Doe",
    primary_phone: "1234567890"
  };
  ↓

NODE PROCESSES RESULT:
  return {
    variables: {
      customer_id: result.id,
      customer_code: result.code
    },
    naturalResponse: "Perfect! I've created your profile.",
    metadata: {
      totalMcpCalls: state.metadata.totalMcpCalls + 1
    }
  };
  ↓

STATE UPDATED WITH MCP RESULT
```

### Error Handling in MCP Calls

```typescript
// Node handles MCP errors gracefully

async function createCustomerNode(state, mcpAdapter) {
  try {
    const result = await mcpAdapter.executeMCPTool('customer_create', args, authToken);

    // Success path
    return {
      variables: { customer_id: result.id },
      naturalResponse: "Perfect! Your profile is created."
    };

  } catch (error) {
    // Error path
    console.error('[Node] MCP call failed:', error);

    // Log error
    const errorAction = {
      agentRole: 'worker',
      action: 'mcp_call',
      nodeContext: 'create_customer',
      success: false,
      error: error.message,
      timestamp: new Date()
    };

    // Return graceful error response
    return {
      agentActions: [errorAction],
      error: {
        code: 'CUSTOMER_CREATE_FAILED',
        message: error.message,
        agentRole: 'worker'
      },
      naturalResponse: "I'm having trouble creating your profile. Let me try again.",
      requiresUserInput: false  // Retry without user input
    };
  }
}

// Orchestrator retries on error (stays on same node)
if (result.error && result.error.code === 'CUSTOMER_CREATE_FAILED') {
  // Retry logic: invoke same node again
  // Or escalate after N failures
}
```

---

## Database Persistence Layer

### Entity Relationships

```
orchestrator_session (1) ──┬──< orchestrator_state (M)
                           ├──< orchestrator_agent_log (M)
                           └──< orchestrator_summary (M)

orchestrator_session.chat_session_id ──> f_customer_interaction.id (optional)

orchestrator_state ──> stores variables:
  - customer_id (links to d_customer.id)
  - task_id (links to d_task.id)
  - selected_employee_id (links to d_employee.id)

Intentionally NO foreign keys for flexibility
```

### Query Patterns

```sql
-- Get full session state
SELECT
  s.*,
  json_agg(st.*) as state_variables,
  json_agg(al.*) as agent_logs
FROM orchestrator_session s
LEFT JOIN orchestrator_state st ON st.session_id = s.id
LEFT JOIN orchestrator_agent_log al ON al.session_id = s.id
WHERE s.id = 'uuid-123'
GROUP BY s.id;

-- Get active sessions
SELECT * FROM orchestrator_session
WHERE status = 'active'
AND updated_ts > NOW() - INTERVAL '1 hour';

-- Get sessions by intent
SELECT * FROM orchestrator_session
WHERE current_intent = 'CalendarBooking'
AND created_ts > NOW() - INTERVAL '24 hours';

-- Audit trail for debugging
SELECT
  al.created_ts,
  al.agent_role,
  al.agent_action,
  al.node_context,
  al.mcp_tool_name,
  al.success,
  al.duration_ms,
  al.error_message
FROM orchestrator_agent_log al
WHERE al.session_id = 'uuid-123'
ORDER BY al.created_ts ASC;

-- Performance analysis
SELECT
  s.current_intent,
  COUNT(*) as session_count,
  AVG(s.total_agent_calls) as avg_agent_calls,
  AVG(s.total_mcp_calls) as avg_mcp_calls,
  AVG(EXTRACT(EPOCH FROM (s.updated_ts - s.created_ts))) as avg_duration_seconds
FROM orchestrator_session s
WHERE s.status = 'completed'
GROUP BY s.current_intent;
```

---

## Error Handling and Retry Logic

### Error Categories

1. **Network Errors** (MCP call timeouts)
2. **Authentication Errors** (Invalid JWT)
3. **Authorization Errors** (RBAC failure)
4. **Validation Errors** (Invalid input)
5. **Business Logic Errors** (No availability, duplicate booking)
6. **System Errors** (Database down, service unavailable)

### Error Handling Strategy

```typescript
// Multi-layer error handling

// Layer 1: Node Level
async function createBookingNode(state, mcpAdapter) {
  try {
    const result = await mcpAdapter.executeMCPTool('task_create', args, token);
    return { success: true, ... };
  } catch (error) {
    return {
      error: { code: 'BOOKING_FAILED', message: error.message },
      naturalResponse: "I'm having trouble creating your booking."
    };
  }
}

// Layer 2: MCP Adapter Level
async executeMCPTool(toolName, args, authToken) {
  try {
    const response = await axios.post(url, data, { headers, timeout: 5000 });
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed');
    } else if (error.response?.status === 403) {
      throw new Error('Permission denied');
    } else {
      throw new Error(`MCP call failed: ${error.message}`);
    }
  }
}

// Layer 3: Entity API Level
async createCustomer(request, reply) {
  try {
    const result = await db.insert(d_customer).values(data);
    return reply.code(201).send(result);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return reply.code(409).send({ error: 'Customer already exists' });
    } else {
      console.error('[CustomerAPI] Error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}

// Layer 4: Orchestrator Level
async processMessage(args) {
  try {
    const result = await graph.invoke(state, config);
    return result;
  } catch (error) {
    console.error('[Orchestrator] Fatal error:', error);
    // Return graceful error to user
    return {
      sessionId: args.sessionId || 'error',
      response: "I'm experiencing technical difficulties. Please try again later.",
      error: { code: 'ORCHESTRATOR_ERROR', message: error.message }
    };
  }
}
```

---

## Authentication Flow

### JWT Token Journey

```
USER LOGS IN:
  POST /api/v1/auth/login
  { email: 'user@example.com', password: '...' }
  ↓

AUTH SERVICE:
  1. Validate credentials
  2. Generate JWT:
     jwt.sign(
       { sub: userId, email, roles: ['admin'], permissions: ['customer:read', 'customer:write'] },
       secret,
       { expiresIn: '24h' }
     )
  3. Return: { token: 'eyJhbGc...' }
  ↓

FRONTEND STORES TOKEN:
  localStorage.setItem('authToken', token);
  ↓

FRONTEND MAKES ORCHESTRATOR REQUEST:
  POST /api/v1/chat/langgraph/message
  Headers: { Authorization: 'Bearer eyJhbGc...' }
  ↓

ORCHESTRATOR EXTRACTS TOKEN:
  authToken = request.headers.authorization?.replace('Bearer ', '');
  ↓

ORCHESTRATOR PASSES TO MCP:
  mcpAdapter.executeMCPTool('customer_create', args, authToken);
  ↓

MCP PASSES TO ENTITY API:
  POST /api/v1/customer/create
  Headers: { Authorization: 'Bearer eyJhbGc...' }
  ↓

ENTITY API VERIFIES:
  decoded = jwt.verify(token, secret);
  // decoded = { sub, email, roles, permissions, exp }

  if (decoded.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }
  ↓

RBAC CHECK:
  hasPermission = decoded.permissions.includes('customer:create');

  if (!hasPermission) {
    return 403 Forbidden;
  }
  ↓

REQUEST PROCEEDS WITH USER CONTEXT
```

---

## Session Lifecycle

### Complete Session Timeline

```
TIME: T+0s (First Message)
  USER: "I need landscaping service"
  STATE: null
  ACTION: detectIntent() → "CalendarBooking"
  CREATE: Session uuid-123, status='active', node='entry'
  RESPONSE: "Hi! Can I get your name and phone number?"

TIME: T+30s (Second Message)
  USER: "I'm John, 416-555-1234"
  STATE: Loaded from checkpoint
  EXTRACT: customer_name='John', customer_phone='4165551234'
  NODE: identify_customer
  MCP: customer_list(phone='4165551234') → Not found
  UPDATE: is_new_customer=true, node='create_customer'
  RESPONSE: "Thanks John! What's your service address?"

TIME: T+60s (Third Message)
  USER: "123 Main St, Toronto"
  STATE: Loaded from checkpoint
  EXTRACT: customer_address='123 Main St', customer_city='Toronto'
  NODE: create_customer
  MCP: customer_create(...) → { id: 'cust-uuid', code: 'CUST-001' }
  UPDATE: customer_id='cust-uuid', node='gather_booking_requirements'
  RESPONSE: "Perfect! Now let's schedule your service."

TIME: T+90s (Fourth Message)
  USER: "Landscaping on 2025-11-15, morning would be great"
  STATE: Loaded from checkpoint
  EXTRACT: service_category='Landscaping', desired_date='2025-11-15', desired_time='morning'
  NODE: gather_booking_requirements → find_available_slots
  MCP: employee_list(department='Landscaping') → [{ id: 'emp-uuid', name: 'Mike' }]
  UPDATE: available_employees=[...], node='propose_options'
  RESPONSE: "Great! We have technicians available. I can schedule you with Mike on 2025-11-15 at 9:00 AM. Does that work?"

TIME: T+120s (Fifth Message)
  USER: "Perfect, let's do it"
  STATE: Loaded from checkpoint
  NODE: propose_options → create_booking
  MCP: task_create(...) → { id: 'task-uuid', code: 'TASK-001' }
  MCP: linkage_create(customer→task) → Success
  UPDATE: task_id='task-uuid', node='confirm_and_summarize'
  STATUS: completed=true, conversationEnded=true, endReason='completed'
  RESPONSE: "Perfect! You're all set, John. 📅 Booking Confirmed..."

TIME: T+120s+ (Session Complete)
  SESSION: status='completed'
  SUMMARY: Generated and saved
  CHAT: Can be closed, session persisted for future reference
```

---

## Performance Optimizations

### Implemented Optimizations

1. **Connection Pooling**
   ```typescript
   // PostgreSQL connection pool
   const pool = new Pool({
     max: 20,              // Max connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000
   });
   ```

2. **State Caching**
   ```typescript
   // In-memory cache for active sessions
   const sessionCache = new Map<string, OrchestratorState>();

   async getState(sessionId) {
     if (sessionCache.has(sessionId)) {
       return sessionCache.get(sessionId);
     }
     const state = await loadFromDatabase(sessionId);
     sessionCache.set(sessionId, state);
     return state;
   }
   ```

3. **Async Checkpoint Saving**
   ```typescript
   // Non-blocking checkpoint save
   await graph.invoke(state, config);

   // Save checkpoint asynchronously (doesn't block response)
   checkpointer.put(config, checkpoint, metadata)
     .catch(error => console.error('[Checkpoint] Save failed:', error));

   return response; // Return immediately
   ```

4. **Batch State Updates**
   ```typescript
   // Instead of individual inserts, batch upsert
   await db.insert(orchestrator_state)
     .values(stateVariablesArray)  // Multiple rows at once
     .onConflict(...)
     .doUpdate(...);
   ```

5. **Index Optimization**
   ```sql
   -- Fast session lookups
   CREATE INDEX idx_orchestrator_session_status
     ON orchestrator_session(status) WHERE status = 'active';

   -- Fast state variable lookups
   CREATE UNIQUE INDEX idx_orchestrator_state_session_key
     ON orchestrator_state(session_id, key);

   -- Fast agent log queries
   CREATE INDEX idx_orchestrator_log_session_ts
     ON orchestrator_agent_log(session_id, created_ts DESC);
   ```

### Performance Metrics

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| Message processing | < 2s | 500-1500ms | Without MCP calls |
| MCP tool call | < 500ms | 100-300ms | Network + API processing |
| State load | < 50ms | 10-30ms | From PostgreSQL |
| Checkpoint save | < 100ms | 20-50ms | Async, doesn't block |
| Graph invoke | < 1s | 200-800ms | Depends on node complexity |

---

## Summary

This document provides complete end-to-end visibility into the orchestrator's internal architecture:

- **Request Flow**: User input → API → LangGraph → MCP → Database → Response
- **Component Interactions**: How Fastify, LangGraph, MCP, and PostgreSQL work together
- **State Management**: Checkpointing, persistence, and recovery mechanisms
- **MCP Plumbing**: Tool execution flow with complete authentication and authorization
- **Database Layer**: Schema, relationships, and query patterns
- **Error Handling**: Multi-layer error handling with graceful degradation
- **Authentication**: JWT token journey through all layers
- **Session Lifecycle**: Complete timeline from creation to completion
- **Performance**: Optimizations and typical metrics

**Use this guide to:**
- Understand how a user message flows through the entire system
- Debug issues at any layer
- Extend the orchestrator with new workflows
- Optimize performance bottlenecks
- Onboard new developers to the architecture

---

**For questions or clarifications, refer to other orchestrator documentation or contact the development team.**
