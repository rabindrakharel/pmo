# Text Chat Session Management - Technical Architecture

**Version:** 3.1.0 | **Status:** Production | **Updated:** 2025-11-07

> **Audience:** Staff architects and engineers implementing or extending the text chat system
>
> **Context:** This document covers the correct session management pattern for text chat using the LangGraph orchestrator

---

## 1. Semantics & Business Context

### Purpose
Dual-session management architecture that separates chat interaction tracking (customer-facing) from orchestrator state management (internal AI workflow) to enable reliable, stateful conversations with proper audit trails.

### Business Problem Solved
**Problem:** Frontend directly calling LangGraph endpoints with chat session IDs caused foreign key constraint violations because:
- Chat sessions (`f_customer_interaction`) track customer interactions
- Orchestrator sessions (`orchestrator_session`) track AI workflow state
- These are separate concerns with separate lifecycles

**Solution:** Unified `/api/v1/chat/message` endpoint that:
- Manages both session types transparently
- Creates orchestrator sessions on-demand
- Links them via metadata for audit trail
- Prevents direct LangGraph exposure to frontend

### Core Value Proposition
Separation of concerns: Customer interaction history (compliance, analytics) remains independent from AI workflow state (LLM orchestration), enabling flexible architecture evolution.

---

## 2. Architecture & DRY Design Patterns

### System Block Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  FRONTEND (ChatWidget.tsx)                                      │
│                                                                  │
│  1. User opens chat                                             │
│     ↓                                                            │
│  2. POST /api/v1/chat/session/new                               │
│     { customer_id, customer_email, customer_name }              │
│     ↓                                                            │
│  3. Receive chat_session_id + greeting                          │
│     ↓                                                            │
│  4. User sends message                                          │
│     ↓                                                            │
│  5. POST /api/v1/chat/message ✅ CORRECT ENDPOINT               │
│     { session_id: chat_session_id, message }                    │
│                                                                  │
└─────────────────────────┬──────────────────────────────────────┘
                          │
        ╔═════════════════╧════════════════════╗
        ║ ❌ INCORRECT (OLD - CAUSES FK ERROR) ║
        ║ POST /api/v1/chat/langgraph/message  ║
        ║ (Frontend should NEVER call this)    ║
        ╚══════════════════════════════════════╝
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│  BACKEND API (routes.ts)                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Endpoint: POST /api/v1/chat/message                    │   │
│  │ File: apps/api/src/modules/chat/routes.ts:92-193      │   │
│  │                                                         │   │
│  │ 1. Validate request                                    │   │
│  │    - Require: session_id, message                      │   │
│  │    - Extract: JWT token from Authorization header      │   │
│  │                                                         │   │
│  │ 2. Load chat session                                   │   │
│  │    const session = await getSession(session_id)        │   │
│  │    // Returns data from f_customer_interaction         │   │
│  │                                                         │   │
│  │ 3. Get/create orchestrator session                     │   │
│  │    const orchestratorSessionId =                       │   │
│  │      session.metadata?.orchestrator_session_id || null │   │
│  │    // First message: null (auto-creates)               │   │
│  │    // Subsequent: UUID (reuses existing)               │   │
│  │                                                         │   │
│  │ 4. Process via LangGraph                               │   │
│  │    const result = await orchestrator.processMessage({  │   │
│  │      sessionId: orchestratorSessionId, // ✅ Correct   │   │
│  │      message,                                          │   │
│  │      chatSessionId: session_id,  // For linkage       │   │
│  │      userId: customer_id,                              │   │
│  │      authToken: token            // For MCP tools      │   │
│  │    })                                                   │   │
│  │                                                         │   │
│  │ 5. Update chat session                                 │   │
│  │    await updateSession(session_id, updatedConv, {      │   │
│  │      metadata: {                                       │   │
│  │        orchestrator_session_id: result.sessionId,      │   │
│  │        current_intent: result.intent,                  │   │
│  │        current_node: result.currentNode                │   │
│  │      }                                                  │   │
│  │    })                                                   │   │
│  │                                                         │   │
│  │ 6. Return response                                     │   │
│  │    { session_id, response, tokens_used, ... }          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│         ┌──────────────────┴──────────────────┐                │
│         ▼                                      ▼                │
│  ┌──────────────────┐              ┌─────────────────────┐     │
│  │ conversation     │              │ LangGraph           │     │
│  │ .service.ts      │              │ Orchestrator        │     │
│  │                  │              │ Service             │     │
│  │ Manages:         │              │                     │     │
│  │ • Chat history   │              │ Manages:            │     │
│  │ • Interaction    │              │ • Workflow state    │     │
│  │   tracking       │              │ • Agent execution   │     │
│  │ • Analytics      │              │ • MCP tool calls    │     │
│  │   metadata       │              │ • Graph traversal   │     │
│  └──────────────────┘              └─────────────────────┘     │
│         │                                      │                │
│         ▼                                      ▼                │
│  ┌──────────────────┐              ┌─────────────────────┐     │
│  │ f_customer_      │              │ orchestrator_       │     │
│  │ interaction      │───link via───│ session             │     │
│  │                  │   metadata   │                     │     │
│  │ • session_id     │              │ • id (UUID)         │     │
│  │ • content_text   │              │ • current_node      │     │
│  │ • metadata {     │              │ • current_intent    │     │
│  │     orchestrator_│              │ • auth_metadata     │     │
│  │     session_id   │              │                     │     │
│  │   }              │              │                     │     │
│  └──────────────────┘              └─────────────────────┘     │
│                                             │                   │
│                                             ▼                   │
│                                    ┌─────────────────────┐     │
│                                    │ orchestrator_       │     │
│                                    │ state (key-value)   │     │
│                                    │                     │     │
│                                    │ FK: session_id      │     │
│                                    │ Must reference      │     │
│                                    │ orchestrator_session│     │
│                                    └─────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

### DRY Design Patterns

#### 1. **Facade Pattern - Unified Chat Endpoint**
```typescript
// Pattern: Single entry point hides complexity
// Location: apps/api/src/modules/chat/routes.ts:92-193

POST /api/v1/chat/message
  ├─> Validates auth & session
  ├─> Loads chat session (f_customer_interaction)
  ├─> Manages orchestrator session lifecycle
  ├─> Delegates to LangGraph orchestrator
  ├─> Updates both session types
  └─> Returns unified response

// Benefits:
// - Frontend complexity reduced to 1 endpoint
// - Session management logic centralized
// - Easy to swap orchestrator implementation
// - Clear separation of concerns
```

#### 2. **Dual-Session Pattern - Separation of Concerns**
```typescript
// Pattern: Different sessions for different purposes

Chat Session (f_customer_interaction)
├─ Purpose: Customer interaction tracking
├─ Lifecycle: Created on chat open, closed on end
├─ Contains: Messages, sentiment, resolution
└─ Used for: Analytics, compliance, customer history

Orchestrator Session (orchestrator_session)
├─ Purpose: AI workflow state management
├─ Lifecycle: Created on first message, completed on workflow end
├─ Contains: Current node, intent, agent logs
└─ Used for: LangGraph execution, retry logic, debugging

Link: chat_session.metadata.orchestrator_session_id → orchestrator_session.id
```

#### 3. **Lazy Initialization Pattern**
```typescript
// Pattern: Create orchestrator session only when needed

const orchestratorSessionId = session.metadata?.orchestrator_session_id;
// First message: undefined → processMessage creates new session
// Subsequent:    UUID     → processMessage reuses existing

// Benefits:
// - No wasted sessions for users who never send messages
// - Automatic session creation without extra API calls
// - Graceful handling of session restoration
```

---

## 3. Database, API & UI/UX Mapping

### Database Schema

#### `app.f_customer_interaction` (Chat Sessions)
```sql
CREATE TABLE app.f_customer_interaction (
  id uuid PRIMARY KEY,
  interaction_number varchar(50) UNIQUE,  -- INT-2025-00001
  interaction_type varchar(50),           -- 'chat'
  channel varchar(50),                    -- 'live_chat'
  interaction_person_entities jsonb,      -- [{ person_entity_type: 'customer', person_entity_id }]
  content_text text,                      -- JSON stringified conversation history
  metadata jsonb,                         -- { orchestrator_session_id, customer_name, ... }
  sentiment_score numeric(5,2),
  sentiment_label varchar(20),
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Key indexes
CREATE INDEX idx_f_cust_interaction_metadata ON f_customer_interaction USING gin(metadata);
```

**Critical Fields:**
- `metadata->>'orchestrator_session_id'`: Links to orchestrator session
- `content_text`: Full conversation history (for analytics)
- `interaction_person_entities`: Array of customer/employee references

#### `app.orchestrator_session` (LangGraph Sessions)
```sql
CREATE TABLE app.orchestrator_session (
  id uuid PRIMARY KEY,
  session_number varchar(50) UNIQUE,      -- ORCH-2025-00001
  chat_session_id uuid,                   -- Link back to f_customer_interaction
  user_id uuid,
  current_intent varchar(100),            -- 'CalendarBooking'
  current_node varchar(100),              -- 'I_greet_customer'
  status varchar(50) DEFAULT 'active',    -- active/completed/failed
  auth_metadata jsonb DEFAULT '{}',       -- { authToken } for MCP calls
  session_context jsonb DEFAULT '{}',
  total_agent_calls integer DEFAULT 0,
  total_mcp_calls integer DEFAULT 0,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Key indexes
CREATE INDEX idx_orchestrator_session_chat_id ON orchestrator_session(chat_session_id);
```

**Critical Fields:**
- `chat_session_id`: Reverse link to f_customer_interaction (optional)
- `auth_metadata->>'authToken'`: JWT for authenticated MCP tool calls
- `current_node`: Where we are in the LangGraph workflow

#### `app.orchestrator_state` (Session Variables)
```sql
CREATE TABLE app.orchestrator_state (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,               -- FK to orchestrator_session.id
  key varchar(100) NOT NULL,              -- 'customer_name', 'booking_date'
  value jsonb NOT NULL,
  value_type varchar(50),                 -- 'string', 'number', 'object'
  source varchar(100),                    -- Which agent/node produced this
  validated boolean DEFAULT false,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),

  CONSTRAINT orchestrator_state_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES orchestrator_session(id)
    ON DELETE CASCADE,

  CONSTRAINT orchestrator_state_session_id_key_key
    UNIQUE (session_id, key)
);
```

**Critical Constraints:**
- FK to `orchestrator_session.id` (NOT to `f_customer_interaction.id`)
- Unique constraint prevents duplicate keys per session
- CASCADE delete cleans up state when session deleted

### API Endpoints

#### Text Chat Flow

```http
# 1. Create chat session
POST /api/v1/chat/session/new
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "customer_id": "uuid",
  "customer_email": "user@example.com",
  "customer_name": "John Doe"
}

Response 201:
{
  "session_id": "uuid",           // f_customer_interaction.id
  "greeting": "Hi! How can I help?",
  "timestamp": "2025-11-07T..."
}

# 2. Send message (auto-creates orchestrator session)
POST /api/v1/chat/message
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "session_id": "uuid",           // From step 1
  "message": "I need landscaping help"
}

Response 200:
{
  "session_id": "uuid",
  "response": "What brings you here today?",
  "booking_created": false,
  "tokens_used": 100,
  "timestamp": "2025-11-07T..."
}

# 3. Continue conversation (reuses orchestrator session)
POST /api/v1/chat/message
Authorization: Bearer <JWT>

{
  "session_id": "uuid",           // Same session
  "message": "My grass is dry"
}
```

#### ❌ INCORRECT - Direct LangGraph Call (Causes FK Error)

```http
# ⚠️ DO NOT USE FROM FRONTEND
POST /api/v1/chat/langgraph/message
Authorization: Bearer <JWT>

{
  "session_id": "chat-session-uuid",    # ❌ WRONG SESSION TYPE
  "message": "Hello"
}

Error 500:
{
  "error": "Internal server error",
  "message": "insert or update on table \"orchestrator_state\"
              violates foreign key constraint
              \"orchestrator_state_session_id_fkey\""
}

# Why it fails:
# - LangGraph expects orchestrator_session.id
# - Frontend passes f_customer_interaction.id
# - orchestrator_state FK constraint rejects invalid session_id
```

### UI/UX Mapping

#### ChatWidget.tsx Implementation

```typescript
// Location: apps/web/src/components/chat/ChatWidget.tsx

// ✅ CORRECT - Session creation
async function initializeSession() {
  const response = await fetch(`${apiBaseUrl}/api/v1/chat/session/new`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customer_id: user?.id,
      customer_email: user?.email,
      customer_name: user?.name || user?.email
    })
  });

  const data = await response.json();
  setSessionId(data.session_id);  // Store chat session ID
  setMessages([{
    role: 'assistant',
    content: data.greeting,
    timestamp: data.timestamp
  }]);
}

// ✅ CORRECT - Message sending
async function handleSendMessage(e) {
  e.preventDefault();

  const userMessage = {
    role: 'user',
    content: inputValue.trim(),
    timestamp: new Date().toISOString()
  };

  setMessages(prev => [...prev, userMessage]);
  setInputValue('');
  setIsLoading(true);

  try {
    const token = localStorage.getItem('auth_token');

    // ✅ CORRECT ENDPOINT - Unified chat API
    const response = await fetch(`${apiBaseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,     // ✅ Chat session ID
        message: userMessage.content
      })
    });

    const data = await response.json();

    const assistantMessage = {
      role: 'assistant',
      content: data.response,
      timestamp: data.timestamp
    };

    setMessages(prev => [...prev, assistantMessage]);

  } catch (err) {
    console.error('Failed to send message:', err);
    setError('Failed to send message. Please try again.');
  } finally {
    setIsLoading(false);
  }
}
```

---

## 4. Entity Relationships

### Database DDL Changes (v3.1.0)

#### Fixed: orchestrator_state.ddl
```sql
-- BEFORE (Had duplicate index issue)
CREATE INDEX idx_orchestrator_state_key
  ON app.orchestrator_state(session_id, key);
CREATE UNIQUE INDEX idx_orchestrator_state_unique_key
  ON app.orchestrator_state(session_id, key);

-- AFTER (Clean unique constraint)
CREATE INDEX idx_orchestrator_state_session
  ON app.orchestrator_state(session_id);
CREATE INDEX idx_orchestrator_state_key
  ON app.orchestrator_state(key);
ALTER TABLE app.orchestrator_state
  ADD CONSTRAINT orchestrator_state_session_id_key_key
  UNIQUE (session_id, key);
```

#### Added to db-import.sh
```bash
# AI Orchestrator session management (order matters)
execute_sql "$DB_PATH/60_orchestrator_session.ddl" \
  "AI orchestrator session state management"
execute_sql "$DB_PATH/61_orchestrator_state.ddl" \
  "AI orchestrator state key-value store"              # ✅ ADDED
execute_sql "$DB_PATH/62_orchestrator_agent_log.ddl" \
  "AI orchestrator agent execution logs"               # ✅ ADDED
execute_sql "$DB_PATH/63_orchestrator_summary.ddl" \
  "AI orchestrator conversation summaries"             # ✅ ADDED
execute_sql "$DB_PATH/40_orchestrator_agents.ddl" \
  "Multi-agent orchestrator (circuit breaker, agent execution, checkpoints)"
```

### Entity Relationship Diagram

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  d_employee (Authenticated Users)                     │
│  ├─ id: uuid                                           │
│  ├─ email: varchar                                     │
│  └─ name: varchar                                      │
│                                                        │
└───────────────┬────────────────────────────────────────┘
                │
                │ user_id (who initiated chat)
                │
                ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│  f_customer_interaction (Chat Sessions)                │
│  ├─ id: uuid PRIMARY KEY                               │
│  ├─ interaction_number: varchar UNIQUE                 │
│  ├─ interaction_type: 'chat'                           │
│  ├─ channel: 'live_chat'                               │
│  ├─ content_text: text (conversation history)          │
│  ├─ metadata: jsonb {                                  │
│  │    orchestrator_session_id: uuid,  ◄────┐          │
│  │    customer_name: string,               │          │
│  │    resolution_status: string            │          │
│  │  }                                       │          │
│  ├─ sentiment_score: numeric               │          │
│  ├─ sentiment_label: varchar               │          │
│  └─ timestamps                              │          │
│                                             │          │
└─────────────────────────────────────────────┼──────────┘
                                              │
                          metadata link (soft reference)
                                              │
                                              ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│  orchestrator_session (LangGraph Sessions)             │
│  ├─ id: uuid PRIMARY KEY                               │
│  ├─ session_number: varchar UNIQUE                     │
│  ├─ chat_session_id: uuid (optional reverse link)      │
│  ├─ user_id: uuid                                      │
│  ├─ current_intent: varchar ('CalendarBooking')        │
│  ├─ current_node: varchar ('I_greet_customer')         │
│  ├─ status: varchar ('active'|'completed'|'failed')    │
│  ├─ auth_metadata: jsonb { authToken: string }         │
│  ├─ session_context: jsonb                             │
│  ├─ total_agent_calls: integer                         │
│  └─ timestamps                                         │
│                                                        │
└───────────────┬────────────────────────────────────────┘
                │
                │ session_id FK CONSTRAINT
                │ (Critical: Must reference orchestrator_session.id)
                │
                ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│  orchestrator_state (Session Variables)                │
│  ├─ id: uuid PRIMARY KEY                               │
│  ├─ session_id: uuid NOT NULL ◄─── FK to above        │
│  ├─ key: varchar ('customer_name', 'booking_date')     │
│  ├─ value: jsonb                                       │
│  ├─ value_type: varchar                                │
│  ├─ source: varchar (which agent/node)                 │
│  ├─ validated: boolean                                 │
│  └─ timestamps                                         │
│                                                        │
│  CONSTRAINT orchestrator_state_session_id_fkey         │
│    FOREIGN KEY (session_id)                            │
│    REFERENCES orchestrator_session(id)                 │
│    ON DELETE CASCADE                                   │
│                                                        │
└────────────────────────────────────────────────────────┘
                │
                │ session_id FK CONSTRAINT
                │
                ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│  orchestrator_agent_log (Agent Execution Logs)         │
│  ├─ id: uuid PRIMARY KEY                               │
│  ├─ session_id: uuid FK                                │
│  ├─ agent_role: varchar ('Worker', 'Critic', ...)      │
│  ├─ action_type: varchar                               │
│  ├─ success: boolean                                   │
│  └─ duration_ms: integer                               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 5. User Interaction Flow Examples

### Example 1: New User - First Chat Session

```
User Action                    | Frontend                  | Backend API              | Database
──────────────────────────────────────────────────────────────────────────────────────────────────
1. User clicks chat icon       | ChatWidget renders        | -                        | -
2. Auto-open chat              | initializeSession()       | -                        | -
3. POST /session/new           | → Bearer JWT              | createSession()          | INSERT f_customer_interaction
                               |                           |                          | id = 'aaa-111'
4. Receive greeting            | ← session_id: aaa-111     | generateGreeting()       | -
                               |   greeting: "Hi! How..."  |                          |
5. Display chat with greeting  | setMessages([...])        | -                        | -
──────────────────────────────────────────────────────────────────────────────────────────────────
6. User types: "I need help"   | handleSendMessage()       | -                        | -
7. POST /message               | → session_id: aaa-111     | getSession(aaa-111)      | SELECT f_customer_interaction
                               |   message: "I need help"  |                          | WHERE id = 'aaa-111'
                               |                           |                          |
8. Backend: Check orchestrator | -                         | session.metadata.        | -
   session                     |                           |   orchestrator_session_  |
                               |                           |   id = undefined         |
                               |                           |                          |
9. Backend: Create LangGraph   | -                         | orchestrator.process     | INSERT orchestrator_session
   session (lazy init)         |                           | Message({                | id = 'bbb-222'
                               |                           |   sessionId: undefined,  | chat_session_id = 'aaa-111'
                               |                           |   ... })                 | current_node = 'I_greet_customer'
                               |                           |                          |
10. LangGraph processes        | -                         | LangGraph state graph    | INSERT orchestrator_state
                               |                           | executes nodes           | session_id = 'bbb-222'
                               |                           |                          | key = 'who_are_you'
                               |                           |                          | value = '"polite agent"'
                               |                           |                          |
11. Update chat session        | -                         | updateSession(aaa-111,   | UPDATE f_customer_interaction
    with link                  |                           |   ..., {                 | SET metadata = metadata || {
                               |                           |     metadata: {          |   orchestrator_session_id: 'bbb-222'
                               |                           |       orchestrator_      | }
                               |                           |       session_id: 'bbb-  | WHERE id = 'aaa-111'
                               |                           |       222'               |
                               |                           |     }                    |
                               |                           |   })                     |
                               |                           |                          |
12. Return response            | ← response: "What brings  | -                        | -
                               |   you here today?"        |                          |
13. Display AI message         | setMessages([...])        | -                        | -
──────────────────────────────────────────────────────────────────────────────────────────────────
14. User types: "Landscaping"  | handleSendMessage()       | -                        | -
15. POST /message              | → session_id: aaa-111     | getSession(aaa-111)      | SELECT f_customer_interaction
                               |   message: "Landscaping"  |                          | metadata->>'orchestrator_session_id'
                               |                           |                          | = 'bbb-222' ✅ FOUND
                               |                           |                          |
16. Backend: Reuse existing    | -                         | orchestrator.process     | UPDATE orchestrator_session
    orchestrator session       |                           | Message({                | SET current_node = 'III_identify_issue'
                               |                           |   sessionId: 'bbb-222',  | WHERE id = 'bbb-222'
                               |                           |   ... })                 |
                               |                           |                          |
17. LangGraph continues        | -                         | Resume from current_node | UPDATE orchestrator_state
    workflow                   |                           |                          | SET value = '"Landscaping"'
                               |                           |                          | WHERE session_id = 'bbb-222'
                               |                           |                          | AND key = 'matching_service_catalog'
                               |                           |                          |
18. Return response            | ← response: "I understand | -                        | -
                               |   you need landscaping"   |                          |
19. Display AI message         | setMessages([...])        | -                        | -
```

### Example 2: ❌ Common Mistake - Direct LangGraph Call

```
User Action                    | Frontend (INCORRECT)      | Backend API              | Result
──────────────────────────────────────────────────────────────────────────────────────────────────
1. User sends message          | handleSendMessage()       | -                        | -
                               |                           |                          |
2. ❌ POST /langgraph/message  | → session_id: aaa-111     | LangGraph routes.ts:17   | ⚠️ Request received
   (WRONG ENDPOINT)            |   message: "Hello"        |                          |
                               |                           |                          |
3. LangGraph tries to create   | -                         | processMessage({         | ⚠️ Executing...
   orchestrator session        |                           |   sessionId: 'aaa-111',  | (session_id is chat ID, not
                               |                           |   ... })                 |  orchestrator ID)
                               |                           |                          |
4. Tries to save state         | -                         | saveLangGraphState(      | ❌ FK CONSTRAINT VIOLATION
                               |                           |   'aaa-111', state)      |
                               |                           |                          | INSERT orchestrator_state
                               |                           |                          | session_id = 'aaa-111'
                               |                           |                          |
                               |                           |                          | ❌ ERROR: Foreign key constraint
                               |                           |                          | "orchestrator_state_session_id_fkey"
                               |                           |                          | violated
                               |                           |                          |
                               |                           |                          | Reason: 'aaa-111' exists in
                               |                           |                          | f_customer_interaction,
                               |                           |                          | NOT in orchestrator_session
                               |                           |                          |
5. Error returned              | ← 500 Internal Server     | return reply.code(500)   | ❌ Chat broken
                               |   Error                   |                          |
```

---

## 6. Critical Considerations When Building

### For Frontend Developers

#### ✅ DO

1. **Always use `/api/v1/chat/message`** for text chat
   ```typescript
   // ✅ CORRECT
   fetch(`${apiBaseUrl}/api/v1/chat/message`, { ... })
   ```

2. **Store only the chat session ID** from `/session/new`
   ```typescript
   const data = await response.json();
   setSessionId(data.session_id);  // This is f_customer_interaction.id
   ```

3. **Pass auth token in Authorization header**
   ```typescript
   headers: {
     'Authorization': `Bearer ${token}`,
     'Content-Type': 'application/json'
   }
   ```

4. **Handle loading states** during LangGraph processing
   ```typescript
   setIsLoading(true);  // Before message send
   // ... API call ...
   setIsLoading(false); // After response
   ```

#### ❌ DON'T

1. **Never call `/api/v1/chat/langgraph/message`** from frontend
   ```typescript
   // ❌ WRONG - Causes FK constraint error
   fetch(`${apiBaseUrl}/api/v1/chat/langgraph/message`, { ... })
   ```

2. **Don't manage orchestrator sessions manually**
   ```typescript
   // ❌ WRONG - Backend handles this
   const orchSessionId = await createOrchestratorSession();
   ```

3. **Don't assume session_id is universal**
   ```typescript
   // ❌ WRONG - session_id means different things in different contexts
   // In chat context: f_customer_interaction.id
   // In LangGraph context: orchestrator_session.id
   ```

### For Backend Developers

#### ✅ DO

1. **Use the facade pattern** - Single entry point for chat
   ```typescript
   // ✅ CORRECT - Unified endpoint handles complexity
   fastify.post('/message', async (request, reply) => {
     const session = await getSession(session_id);
     const orchestratorSessionId = session.metadata?.orchestrator_session_id;
     const result = await orchestrator.processMessage({
       sessionId: orchestratorSessionId,  // Not the chat session_id
       chatSessionId: session_id,
       ...
     });
   });
   ```

2. **Link sessions via metadata** - Soft reference pattern
   ```typescript
   await updateSession(session_id, updatedConversation, {
     metadata: {
       ...session.metadata,
       orchestrator_session_id: result.sessionId,  // Store link
       current_intent: result.intent,
       current_node: result.currentNode
     }
   });
   ```

3. **Validate FK relationships** before saving state
   ```typescript
   // Ensure orchestrator session exists before saving state
   const session = await stateManager.getSession(orchestratorSessionId);
   if (!session) {
     // Create session first
     await stateManager.createSession({ ... });
   }
   await stateManager.setState(orchestratorSessionId, key, value);
   ```

4. **Pass auth token to orchestrator** for MCP tool calls
   ```typescript
   const token = request.headers.authorization?.replace('Bearer ', '');
   await orchestrator.processMessage({
     authToken: token  // ✅ Pass JWT for authenticated MCP calls
   });
   ```

#### ❌ DON'T

1. **Don't expose LangGraph endpoint directly** to frontend
   ```typescript
   // ❌ WRONG - No protection against FK violations
   fastify.post('/langgraph/message', async (request, reply) => {
     const { session_id, message } = request.body;
     // If session_id is from f_customer_interaction, FK error occurs
     await orchestrator.processMessage({ sessionId: session_id, ... });
   });
   ```

2. **Don't mix session IDs** - Keep them separate
   ```typescript
   // ❌ WRONG - Using chat session_id as orchestrator session_id
   await orchestrator.processMessage({
     sessionId: chatSessionId  // Will cause FK errors
   });

   // ✅ CORRECT - Use orchestrator session_id
   await orchestrator.processMessage({
     sessionId: orchestratorSessionId,
     chatSessionId: chatSessionId  // Pass separately for linkage
   });
   ```

3. **Don't create orphaned sessions** - Always link them
   ```typescript
   // ❌ WRONG - Orchestrator session has no link to chat session
   await orchestrator.processMessage({ sessionId: null, ... });
   // Result: Can't find original customer interaction for analytics

   // ✅ CORRECT - Pass chat session ID for linking
   await orchestrator.processMessage({
     chatSessionId: session_id  // Creates link in orchestrator_session.chat_session_id
   });
   ```

### For Database Administrators

#### ✅ DO

1. **Maintain FK integrity** - Never disable constraints
   ```sql
   -- ✅ CORRECT - Keep FK constraint active
   ALTER TABLE orchestrator_state
     ADD CONSTRAINT orchestrator_state_session_id_fkey
     FOREIGN KEY (session_id)
     REFERENCES orchestrator_session(id)
     ON DELETE CASCADE;
   ```

2. **Use CASCADE delete** - Clean up dependent data
   ```sql
   -- ✅ CORRECT - Deleting orchestrator_session also deletes state
   ON DELETE CASCADE
   ```

3. **Index foreign keys** - Performance optimization
   ```sql
   -- ✅ CORRECT - Index FK columns
   CREATE INDEX idx_orchestrator_state_session
     ON orchestrator_state(session_id);
   ```

4. **Monitor orphaned records** - Periodic cleanup
   ```sql
   -- Find orchestrator sessions with deleted chat sessions
   SELECT os.id, os.chat_session_id
   FROM orchestrator_session os
   LEFT JOIN f_customer_interaction fci ON os.chat_session_id = fci.id
   WHERE os.chat_session_id IS NOT NULL AND fci.id IS NULL;
   ```

#### ❌ DON'T

1. **Don't use chat session IDs in orchestrator_state**
   ```sql
   -- ❌ WRONG - FK constraint will fail
   INSERT INTO orchestrator_state (session_id, key, value)
   VALUES (
     'aaa-111',  -- ID from f_customer_interaction
     'customer_name',
     '"John Doe"'
   );
   -- ERROR: violates foreign key constraint
   ```

2. **Don't disable FK checks** to bypass errors
   ```sql
   -- ❌ WRONG - Hides architectural problems
   SET session_replication_role = replica;  -- Disables FK checks
   -- Fix the code, not the database
   ```

### Testing Checklist

#### Unit Tests
- [ ] Chat session creation creates entry in `f_customer_interaction`
- [ ] First message creates orchestrator session automatically
- [ ] Subsequent messages reuse existing orchestrator session
- [ ] Orchestrator session ID is stored in chat session metadata
- [ ] State saves reference orchestrator session, not chat session

#### Integration Tests
- [ ] Complete flow: session creation → message 1 → message 2 → session close
- [ ] FK constraints prevent invalid session IDs in orchestrator_state
- [ ] CASCADE delete removes all state when orchestrator session deleted
- [ ] Auth token propagates from chat endpoint to LangGraph to MCP tools

#### Load Tests
- [ ] 1000 concurrent chat sessions don't cause session ID collisions
- [ ] Lazy orchestrator session creation doesn't create race conditions
- [ ] Database FK checks don't become bottleneck under load

---

## Summary

**The Fix:**
```diff
  // ChatWidget.tsx - handleSendMessage()
- fetch(`${apiBaseUrl}/api/v1/chat/langgraph/message`, { ... })
+ fetch(`${apiBaseUrl}/api/v1/chat/message`, { ... })
```

**Why It Matters:**
- `/chat/message` manages BOTH session types transparently
- Frontend complexity reduced to single endpoint
- FK constraints enforced correctly
- Audit trail maintained via metadata linkage
- Backend has flexibility to change orchestrator implementation

**Key Principle:**
> **Separation of Concerns:** Chat sessions track customer interactions (external), orchestrator sessions track AI workflows (internal). Link them via metadata, never mix their IDs.

---

**Version History:**
- v3.1.0 (2025-11-07): Documented text chat fix, session management patterns
- v3.0.0 (2025-11-06): LangGraph migration complete
- v2.0.0 (2025-11-05): Multi-agent orchestrator with state management
