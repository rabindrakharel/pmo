# AI/MCP System - Complete Architecture & Design

**Last Updated:** 2025-11-06
**Status:** ✅ Production Ready
**Components:** MCP Server, MCP Adapter, Voice Orchestrator, LangGraph Multi-Agent System

---

## 1. Semantics & Business Context

### What is This System?

The **AI/MCP System** provides intelligent conversational AI capabilities for the Huron Home Services PMO platform, enabling customers and staff to interact with the system via **text** and **voice** channels. The system leverages:

- **Model Context Protocol (MCP)** - Exposes 149 PMO API endpoints as structured tools for AI agents
- **Multi-Agent Orchestration (LangGraph)** - Coordinates specialized agents to handle complex workflows like calendar booking
- **Voice Pipeline (STT/TTS)** - Converts speech to text and back, enabling natural voice conversations
- **Function Tools** - AI agents can create customers, schedule appointments, search projects, update tasks, etc.

### Business Use Cases

1. **Customer Self-Service** - Customers book appointments, check service status, get quotes via chat/voice
2. **Staff Assistance** - Employees query project data, update tasks, search customer records using natural language
3. **Automated Workflows** - AI handles end-to-end booking: customer creation → task assignment → technician scheduling → confirmation
4. **24/7 Availability** - Voice/text chat operates round-the-clock without human intervention

### Key Capabilities

| Capability | Description | Example |
|------------|-------------|---------|
| **Calendar Booking** | End-to-end service appointment scheduling | "I need a plumber tomorrow at 2pm" → AI creates customer, task, finds technician, books appointment |
| **Project Search** | Natural language project queries | "Show me all kitchen renovation projects in progress" |
| **Customer Management** | Create/update customer records | "Add customer John Smith, 416-555-1234" |
| **Task Tracking** | Check task status, add notes, update workflow | "What's the status of task #1234?" |
| **Employee Lookup** | Find available technicians by skill/location | "Which electricians are free this week?" |

---

## 2. Architecture, Block Diagrams & DRY Design Patterns

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ChatWidget.tsx + VoiceChat.tsx                                  │  │
│  │  • Text input + voice recording                                  │  │
│  │  • WebSocket connection to API                                   │  │
│  │  • Audio playback                                                │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────────────┘
                                  │ WebSocket (text/audio)
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          API LAYER (Fastify)                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Voice Orchestrator Service                                      │  │
│  │  voice-orchestrator.service.ts                                   │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │  │
│  │  │   Whisper   │ →  │  LangGraph  │ →  │  OpenAI     │         │  │
│  │  │   STT       │    │ Orchestrator│    │   TTS       │         │  │
│  │  └─────────────┘    └──────┬──────┘    └─────────────┘         │  │
│  └──────────────────────────────┼───────────────────────────────────┘  │
│                                 ↓                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  LangGraph Orchestrator (Multi-Agent System)                     │  │
│  │  langgraph-orchestrator.service.ts                               │  │
│  │                                                                  │  │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │  │
│  │  │  Critic  │ → │  Worker  │ → │Authenticr│ → │Evaluator │    │  │
│  │  │  Agent   │   │  Agent   │   │  Agent   │   │  Agent   │    │  │
│  │  └──────────┘   └─────┬────┘   └──────────┘   └──────────┘    │  │
│  │                       ↓                                         │  │
│  │                 MCP Function Tools                              │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  MCP Adapter Service                                             │  │
│  │  mcp-adapter.service.ts                                          │  │
│  │  • Converts 149 API endpoints → OpenAI function tools           │  │
│  │  • 60 tools (customer service) or 100 tools (admin)             │  │
│  │  • Handles parameter mapping (path/query/body)                  │  │
│  │  • Executes HTTP requests with JWT auth                         │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────────────┘
                                  │ HTTP REST + JWT
                                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          PMO API (Fastify)                              │
│  • 149 endpoints across 25 categories                                  │
│  • RBAC authorization                                                  │
│  • PostgreSQL database                                                 │
│  • Entities: Project, Task, Customer, Employee, Booking, etc.          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL: MCP Server (Standalone)                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  MCP Server (Claude Desktop Integration)                        │  │
│  │  apps/mcp-server/src/index.ts                                   │  │
│  │  • Stdio transport for Claude Desktop                           │  │
│  │  • Full 149 endpoint manifest                                   │  │
│  │  • JWT authentication                                            │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────────────┘
                                  │ HTTP REST + JWT
                                  ↓
                            PMO API (same as above)
```

### User Interaction Journey (Voice Call)

**Scenario:** Customer calls to book a plumbing service appointment

```
Step 1: User speaks
  Frontend: Captures audio via MediaRecorder (WebRTC)
  → Sends audio blob via WebSocket to API

Step 2: Speech-to-Text (STT)
  API: voice-orchestrator.service.ts → speechToText()
  → Calls OpenAI Whisper API: POST /v1/audio/transcriptions
  → Returns transcript: "I need a plumber tomorrow at 2pm"
  Duration: ~500ms

Step 3: LangGraph Orchestrator Processing
  API: langgraph-orchestrator.service.ts → processMessage()

  3a. Intent Detection (if new session)
    → Analyzes message: "I need a plumber" → Intent: CalendarBooking
    → Creates new session with UUID

  3b. State Management
    → Checks PostgreSQL for existing checkpoint (if continuing session)
    → Loads current state: { currentNode: 'gather_customer_info', variables: {...} }

  3c. Graph Execution (Calendar Booking Workflow)
    Node 1: Entry → Initialize session
    Node 2: Critic → Check if message is on-topic
      • Forbidden topics: politics, news, stocks, sports, weather
      • Off-topic count: 0/2 allowed
      • ✅ On-topic, proceed

    Node 3: Worker → Process user request at current workflow step
      Current step: gather_customer_info
      → Calls OpenAI GPT-4 with:
         - System instructions (workflow step context)
         - User message: "I need a plumber tomorrow at 2pm"
         - Available MCP tools (60 tools)

      → AI decides to call tool: customer_list({ query_search: "phone number or name" })
      → MCP Adapter executes: GET /api/v1/customer?search=...
      → Returns: No customer found

      → AI responds: "I'd be happy to schedule a plumber for you! Can I get your name and phone number?"
      → Saves variables: { service_type: 'plumbing', preferred_time: 'tomorrow 2pm' }

    Node 4: Evaluator → Check if current step is complete
      → Variables collected: service_type ✅, preferred_time ✅
      → Still missing: customer_name ❌, customer_phone ❌
      → Next node: gather_customer_info (stay in current step)
      → Requires user input: true

    → Saves checkpoint to PostgreSQL
    → Returns response: "I'd be happy to schedule a plumber..."

  Duration: ~1500ms

Step 4: Text-to-Speech (TTS)
  API: voice-orchestrator.service.ts → textToSpeech()
  → Calls OpenAI TTS API: POST /v1/audio/speech
    Body: { model: 'tts-1', input: "I'd be happy...", voice: 'alloy' }
  → Returns MP3 audio buffer (128kbps, ~50KB)
  Duration: ~800ms

Step 5: Response to Frontend
  API: Sends audio buffer via WebSocket
  → Headers: session_id, transcript, response_text, current_node, completed=false
  Frontend: Plays audio via Audio element
  Duration: ~2-3 seconds (audio playback)

[User responds: "My name is John Smith, 416-555-1234"]

Step 6: Continue Workflow (same process repeats)
  → STT: "My name is John Smith, 416-555-1234"
  → LangGraph: Loads checkpoint, currentNode=gather_customer_info
  → Worker: Extracts customer_name="John Smith", customer_phone="416-555-1234"
  → Worker: Calls tool: customer_create({ body_name: "John Smith", body_primary_phone: "416-555-1234" })
  → MCP Adapter: POST /api/v1/customer { name: "John Smith", primary_phone: "416-555-1234", ... }
  → Returns: { id: 'customer-uuid-123', ... }
  → Evaluator: gather_customer_info complete ✅ → Next node: create_task
  → TTS: "Great! I've got you in our system. Let me find an available plumber for tomorrow at 2pm."

[Workflow continues through all 7 steps until booking is confirmed]
```

### Plumbing: Request Flow Step-by-Step

#### Text Chat Flow

```
1. User types message in ChatWidget
   Component: ChatWidget.tsx → sendMessage()

2. WebSocket send
   ws.send(JSON.stringify({ type: 'chat', message: "Show me all active projects" }))

3. API receives WebSocket message
   Route: apps/api/src/modules/chat/routes.ts → ws.on('message')

4. Route to Orchestrator
   If intent=text → orchestrator.service.ts → processTextMessage()

5. OpenAI Chat Completion with MCP Tools
   Service: openai.service.ts
   → Calls: POST https://api.openai.com/v1/chat/completions
   Body: {
     model: 'gpt-4-turbo',
     messages: [...conversation history],
     tools: [...60 MCP tools from mcp-adapter.service.ts],
     tool_choice: 'auto'
   }

6. AI decides to call function tool
   Response: { tool_calls: [{ name: 'project_list', arguments: { query_search: 'active' } }] }

7. Execute MCP Tool
   mcp-adapter.service.ts → executeMCPTool()
   → Finds endpoint in API_MANIFEST: { name: 'project_list', path: '/api/v1/project', method: 'GET' }
   → Constructs HTTP request:
      GET http://localhost:4000/api/v1/project?search=active&status=active
      Headers: { Authorization: 'Bearer jwt-token-here' }
   → Returns: { rows: [...projects], count: 15 }

8. Send tool result back to OpenAI
   → Calls OpenAI again with tool result
   Response: "I found 15 active projects: Kitchen Reno (PROJ-001), Bathroom Remodel (PROJ-002), ..."

9. Return to frontend
   ws.send(JSON.stringify({ type: 'response', message: "I found 15 active projects..." }))

10. Display in ChatWidget
    Frontend renders AI response in chat bubble
```

#### Voice Call Flow (already detailed above)

### DRY Design Patterns

#### 1. **API Manifest Pattern** (Single Source of Truth)

**Problem:** Need to expose 149 API endpoints to AI agents in multiple contexts (MCP Server, Voice Chat, Text Chat)

**Solution:** Centralized `api-manifest.ts` with typed endpoint definitions

```typescript
// apps/mcp-server/src/api-manifest.ts
export interface APIEndpoint {
  name: string;                  // Tool name: 'project_list'
  method: 'GET' | 'POST' | ...;
  path: string;                  // '/api/v1/project'
  description: string;
  requiresAuth: boolean;
  category: string;              // 'Project', 'Task', etc.
  parameters?: {
    path?: Record<string, string>;    // :id parameters
    query?: Record<string, string>;   // ?search=... parameters
    body?: Record<string, string>;    // POST body fields
  };
}

export const API_MANIFEST: APIEndpoint[] = [
  {
    name: 'project_list',
    method: 'GET',
    path: '/api/v1/project',
    description: 'List all projects with optional filters',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      query: {
        search: 'Search by name, code, or description',
        status: 'Filter by project status',
        limit: 'Max results (default 50)',
        offset: 'Pagination offset'
      }
    }
  },
  // ... 148 more endpoints
];
```

**Benefits:**
- Single definition for all AI contexts
- Type-safe endpoint metadata
- Easy to add new endpoints (just add to manifest)
- Auto-generates OpenAI function tools

#### 2. **Endpoint-to-Tool Converter Pattern**

**Problem:** OpenAI function tools and MCP tools have different schemas

**Solution:** Generic converter functions

```typescript
// MCP Server: Endpoint → MCP Tool
function endpointToTool(endpoint: APIEndpoint): Tool {
  const parameters = {
    type: 'object',
    properties: {},
    required: []
  };

  // Add path params (required)
  if (endpoint.parameters?.path) {
    for (const [key, desc] of Object.entries(endpoint.parameters.path)) {
      parameters.properties[key] = { type: 'string', description: desc };
      parameters.required.push(key);
    }
  }

  // Add query params (optional)
  if (endpoint.parameters?.query) {
    for (const [key, desc] of Object.entries(endpoint.parameters.query)) {
      parameters.properties[key] = { type: 'string', description: desc };
    }
  }

  // Add body as single JSON string param
  if (endpoint.parameters?.body) {
    parameters.properties.body = {
      type: 'string',
      description: 'JSON body: ' + JSON.stringify(endpoint.parameters.body)
    };
  }

  return {
    name: endpoint.name,
    description: `[${endpoint.method}] ${endpoint.description}`,
    inputSchema: parameters
  };
}

// MCP Adapter: Endpoint → OpenAI Function Tool
function endpointToOpenAITool(endpoint: APIEndpoint): ChatCompletionTool {
  // Similar logic but for OpenAI's schema format
  // Differences: OpenAI supports 'function' type wrapper
}
```

**Benefits:**
- Automatic tool generation from manifest
- Consistent tool schemas
- No manual tool definition needed

#### 3. **Dynamic Parameter Mapping Pattern**

**Problem:** AI provides arguments like `{ body_name: "John", body_phone: "416-555-1234" }` but API expects `{ name: "John", phone: "416-555-1234" }`

**Solution:** Smart parameter extraction in `executeMCPTool()`

```typescript
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>,
  authToken: string
): Promise<any> {
  const endpoint = API_MANIFEST.find(e => e.name === toolName);

  let path = endpoint.path;
  const queryParams: Record<string, any> = {};
  const body: Record<string, any> = {};

  // Extract path params: :id → args.id
  if (endpoint.parameters?.path) {
    for (const key of Object.keys(endpoint.parameters.path)) {
      if (args[key]) {
        path = path.replace(`:${key}`, args[key]);
        delete args[key];
      }
    }
  }

  // Extract query params: query_search → ?search=...
  if (endpoint.parameters?.query) {
    for (const key of Object.keys(endpoint.parameters.query)) {
      const queryKey = `query_${key}`;
      if (args[queryKey]) {
        queryParams[key] = args[queryKey];
        delete args[queryKey];
      }
    }
  }

  // Extract body params: body_name → { name: ... }
  for (const argKey of Object.keys(args)) {
    if (argKey.startsWith('body_')) {
      const fieldName = argKey.substring(5); // Remove 'body_' prefix
      body[fieldName] = args[argKey];
      delete args[argKey];
    }
  }

  // Make HTTP request
  return await axios({
    method: endpoint.method,
    url: `${API_BASE_URL}${path}`,
    headers: { Authorization: `Bearer ${authToken}` },
    params: queryParams,
    data: body
  });
}
```

**Benefits:**
- AI can pass parameters with clear prefixes (body_*, query_*)
- Automatic mapping to correct HTTP request parts
- Support for dynamic fields not in manifest

#### 4. **Multi-Agent Workflow Pattern (LangGraph)**

**Problem:** Complex workflows require multiple steps, decision points, and error handling

**Solution:** State machine with specialized agent nodes

```typescript
// Calendar Booking Workflow Graph
const workflow = new StateGraph(OrchestratorStateAnnotation)
  .addNode('entry', entryNode)
  .addNode('critic', criticNode)          // Check boundaries
  .addNode('gather_intent', workerNode)   // What service?
  .addNode('gather_customer', workerNode) // Customer info?
  .addNode('create_customer', workerNode) // Create record
  .addNode('create_task', workerNode)     // Create service task
  .addNode('find_employee', workerNode)   // Find technician
  .addNode('create_booking', workerNode)  // Book appointment
  .addNode('confirm', workerNode)         // Send confirmation
  .addNode('evaluator', evaluatorNode);   // Check completion

// Edges define flow
workflow
  .addEdge(START, 'entry')
  .addEdge('entry', 'critic')
  .addConditionalEdges('critic', (state) => {
    if (state.offTopicCount >= 2) return END;
    return 'gather_intent';
  })
  .addEdge('gather_intent', 'evaluator')
  .addConditionalEdges('evaluator', (state) => {
    if (state.completed) return END;
    return state.currentNode; // Return to current step
  });

// State persisted to PostgreSQL after each step
```

**Benefits:**
- Clear workflow visualization
- Each node is independently testable
- State persistence allows interruption/resume
- Easy to add new workflows

#### 5. **PostgreSQL Checkpoint Pattern**

**Problem:** Voice conversations can be interrupted, need to resume from same point

**Solution:** Checkpoint every state transition to database

```typescript
// After each graph node execution:
await checkpointer.put({
  configurable: { thread_id: sessionId },
  checkpoint: {
    channel_values: currentState, // Full state object
    version: state.turnCount
  }
});

// On next user message:
const checkpoint = await checkpointer.get({
  configurable: { thread_id: sessionId }
});

if (checkpoint) {
  // Resume from last state
  currentState = checkpoint.checkpoint.channel_values;
  console.log(`Resuming from node: ${currentState.currentNode}`);
}
```

**Benefits:**
- Conversations survive API restarts
- Users can hang up and call back
- Complete audit trail of workflow progression

---

## 3. Database, API & UI/UX Mapping

### Database Schema

#### Table: `app.d_orchestrator_session`
Stores LangGraph workflow sessions

```sql
CREATE TABLE app.d_orchestrator_session (
  session_id UUID PRIMARY KEY,
  chat_session_id UUID,           -- Link to chat session
  user_id UUID,                    -- Customer or employee
  current_intent VARCHAR(100),     -- 'CalendarBooking', etc.
  current_node VARCHAR(100),       -- Current workflow step
  status VARCHAR(50),              -- 'active', 'completed', 'failed'
  variables JSONB,                 -- Collected data: { customer_name: "John", ... }
  messages JSONB[],                -- Conversation history
  agent_actions JSONB[],           -- Agent decisions and tool calls
  turn_count INTEGER,              -- Number of back-and-forth exchanges
  off_topic_count INTEGER,         -- Boundary violations
  completed BOOLEAN,
  conversation_ended BOOLEAN,
  end_reason VARCHAR(100),         -- 'success', 'off_topic', 'max_turns'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Table: `app.d_orchestrator_checkpoint`
Stores LangGraph checkpoints for state persistence

```sql
CREATE TABLE app.d_orchestrator_checkpoint (
  checkpoint_id UUID PRIMARY KEY,
  thread_id UUID,                  -- Same as session_id
  checkpoint_ns VARCHAR(255),      -- Namespace (usually empty string)
  checkpoint JSONB,                -- Full state snapshot
  metadata JSONB,                  -- Additional metadata
  parent_checkpoint_id UUID,       -- Previous checkpoint (for branching)
  created_at TIMESTAMP
);
```

### API Endpoints

#### Voice Chat Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/v1/chat/orchestrator/voice` | POST | Complete voice pipeline (STT → Orchestrator → TTS) | `multipart/form-data`<br>- `file`: Audio blob<br>- `session_id`: UUID (optional)<br>- `voice`: TTS voice (optional) | `audio/mpeg` (MP3)<br>Headers:<br>- `X-Session-Id`<br>- `X-Transcript`<br>- `X-Response-Text`<br>- `X-Current-Node`<br>- `X-Completed` |
| `/api/v1/chat/orchestrator/stt` | POST | Speech-to-Text only | `multipart/form-data`<br>- `file`: Audio blob | `{ transcript: string }` |
| `/api/v1/chat/orchestrator/tts` | POST | Text-to-Speech only | `{ text: string, voice?: string }` | `audio/mpeg` (MP3) |
| `/api/v1/chat/orchestrator/voices` | GET | List available TTS voices | - | `{ voices: [{ id, name, description }] }` |

#### Text Chat Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/v1/chat/message` | POST | Send text message to orchestrator | `{ sessionId?: string, message: string, authToken?: string }` | `{ sessionId, response, intent, currentNode, completed }` |

### UI/UX Components

#### ChatWidget.tsx

**Location:** `apps/web/src/components/chat/ChatWidget.tsx`

**Responsibilities:**
- Text chat interface
- Voice recording button
- WebSocket connection management
- Audio playback
- Message history display

**State:**
```typescript
{
  messages: Message[],           // Chat history
  isRecording: boolean,          // Voice recording active?
  sessionId: string | null,      // Current orchestrator session
  isVoiceCallActive: boolean,    // Voice call in progress?
  mediaRecorder: MediaRecorder | null,
  audioChunks: Blob[]
}
```

**Key Methods:**
```typescript
// Start voice recording
async function startVoiceRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    await sendVoiceMessage(audioBlob);
  };

  mediaRecorder.start();
  setIsRecording(true);
}

// Send voice message via WebSocket or HTTP
async function sendVoiceMessage(audioBlob: Blob) {
  const formData = new FormData();
  formData.append('file', audioBlob);
  formData.append('session_id', sessionId);

  const response = await fetch('/api/v1/chat/orchestrator/voice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData
  });

  // Get metadata from headers
  const transcript = decodeURIComponent(response.headers.get('X-Transcript'));
  const responseText = decodeURIComponent(response.headers.get('X-Response-Text'));
  const newSessionId = response.headers.get('X-Session-Id');

  // Add to chat history
  addMessage({ role: 'user', content: transcript });
  addMessage({ role: 'assistant', content: responseText });

  // Play audio response
  const audioBuffer = await response.arrayBuffer();
  const audio = new Audio(URL.createObjectURL(new Blob([audioBuffer])));
  audio.play();
}
```

---

## 4. DRY Principles & Entity Relationships

### No DDL Changes

The AI/MCP system does not introduce new entity types. It operates on **existing entities** via API:

- **Customer** (`app.d_customer`)
- **Employee** (`app.d_employee`)
- **Task** (`app.d_task`)
- **Project** (`app.d_project`)
- **Booking** (`app.d_booking`)
- **Worksite** (`app.d_worksite`)
- **etc.**

### Entity Relationships Used

```
Customer ──────> Task (via entity_id_map)
   ↓
Customer ──────> Booking (via entity_id_map)
   │
   └──────> Worksite (customer address)

Task ──────> Employee (assigned_to)
  ↓
Task ──────> Booking (calendar entry)
  ↓
Task ──────> Project (parent entity)

Booking ──────> Employee (technician assigned)
```

### MCP Tool Categories

| Category | Endpoint Count | Key Operations | Example Tools |
|----------|----------------|----------------|---------------|
| **Project** | 10 | CRUD, child entities, tabs | `project_list`, `project_get`, `project_create`, `project_get_tasks` |
| **Task** | 15 | CRUD, Kanban, case notes, activity | `task_list`, `task_create`, `task_update_status`, `task_add_case_note` |
| **Employee** | 5 | CRUD operations | `employee_list`, `employee_get`, `employee_create` |
| **Customer** | 5 | CRUD operations | `customer_list`, `customer_create`, `customer_update` |
| **Booking** | 3 | Appointment scheduling | `booking_list`, `booking_create`, `booking_get` |
| **Business** | 5 | Business unit management | `business_list`, `business_get` |
| **Office** | 5 | Office location management | `office_list`, `office_get` |
| **Worksite** | 5 | Job site management | `worksite_list`, `worksite_create` |
| **Role** | 5 | Employee role management | `role_list`, `role_get` |
| **Position** | 5 | Position management | `position_list`, `position_get` |
| **Wiki** | 5 | Knowledge base | `wiki_list`, `wiki_create` |
| **Form** | 5 | Dynamic forms | `form_list`, `form_get` |
| **Artifact** | 5 | File attachments | `artifact_list`, `artifact_create` |
| **Product** | 4 | Products and services | `product_list`, `product_get` |
| **Sales** | 2 | Quotes | `quote_list`, `quote_create` |
| **Operations** | 2 | Work orders | `workorder_list`, `workorder_get` |
| **Linkage** | 3 | Entity relationships | `linkage_create`, `linkage_list`, `linkage_delete` |
| **Settings** | 1 | Configuration | `setting_list` |
| **Authentication** | 10 | Login, permissions, scopes | `auth_login`, `auth_get_permissions`, `auth_get_scopes` |
| **RBAC** | 2 | Permission checks | `rbac_check_permission` |
| **Entity** | 1 | Entity options | `entity_options_get` |
| **Upload** | 1 | File upload | `upload_file` |
| **S3** | 2 | Presigned URLs, attachments | `s3_get_presigned_url`, `s3_list_attachments` |
| **Workflow** | 2 | Workflow automation | `workflow_list`, `workflow_execute` |
| **Email** | 1 | Email templates | `email_send` |
| **Chat** | 2 | AI chat widget | `chat_create_session`, `chat_send_message` |
| **System** | 2 | Health check, config | `system_health`, `system_config` |
| **TOTAL** | **149** | - | - |

---

## 5. Central Configuration & Middleware

### MCP Adapter Configuration

**File:** `apps/api/src/modules/chat/mcp-adapter.service.ts`

#### Customer Service Tools (60 tools, 18 categories)

```typescript
export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    categories: [
      'Project', 'Task', 'Employee', 'Customer',
      'Business', 'Office', 'Worksite', 'Role', 'Position',
      'Booking', 'Wiki', 'Form', 'Artifact',
      'Product', 'Sales', 'Operations',
      'Linkage', 'Settings'
    ],
    excludeEndpoints: [
      'auth_login', 'auth_logout',
      'customer_signup', 'customer_signin',
      'pmo_authenticate', 'pmo_api_info',
      // Exclude delete operations for safety
      'project_delete', 'task_delete', 'employee_delete',
      'customer_delete', 'business_delete', 'office_delete'
    ],
    maxTools: 60
  });
}
```

#### Admin Tools (100 tools)

```typescript
export function getAllPMOTools(): ChatCompletionTool[] {
  return getMCPTools({
    excludeEndpoints: [
      'auth_login', 'auth_logout',
      'customer_signup', 'customer_signin'
    ],
    maxTools: 100
  });
}
```

### LangGraph Agent Configuration

**File:** `apps/api/src/modules/chat/orchestrator/config/agent-models.config.ts`

```typescript
export const AGENT_MODELS = {
  critic: 'gpt-4-turbo-preview',      // Fast, cheap for boundary checks
  authenticator: 'gpt-4-turbo',       // High quality for customer verification
  worker: 'gpt-4-turbo',              // High quality for main workflow
  evaluator: 'gpt-4-turbo-preview'    // Fast evaluation
};
```

### Voice Configuration

**File:** `apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts`

```typescript
const VOICE_CONFIG = {
  stt: {
    model: 'whisper-1',
    language: 'en'
  },
  tts: {
    model: 'tts-1',           // Options: 'tts-1' (fast), 'tts-1-hd' (quality)
    voice: 'alloy',           // Options: alloy, echo, fable, onyx, nova, shimmer
    response_format: 'mp3',   // Options: mp3, opus, aac, flac
    speed: 1.0                // Range: 0.25 to 4.0
  }
};
```

### Environment Variables

**Required:**
```bash
# OpenAI API Key (for Whisper, TTS, GPT-4)
OPENAI_API_KEY=sk-...

# PMO API URL (for MCP tool execution)
API_ORIGIN=http://localhost:4000

# Database (for checkpoint persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/pmo_db
```

### Authentication Middleware

MCP tools inherit the same RBAC as direct API calls:

```typescript
// In executeMCPTool()
const response = await axios({
  method: endpoint.method,
  url: `${API_BASE_URL}${path}`,
  headers: {
    'Authorization': `Bearer ${authToken}`,  // JWT from frontend
    'Content-Type': 'application/json'
  },
  params: queryParams,
  data: body
});
```

**Effect:** AI agents can only access data the authenticated user has permission to view/edit.

---

## 6. User Interaction Flow Examples

### Example 1: Calendar Booking (Voice)

**Goal:** Customer calls to book a plumbing service

```
Turn 1:
  User: "Hi, I need a plumber"

  System:
    1. STT: "Hi, I need a plumber"
    2. LangGraph:
       - Intent: CalendarBooking
       - Node: entry → critic → gather_intent → evaluator
       - Variables: { service_type: 'plumbing' }
       - Next: gather_customer_info
    3. TTS: "I can help you with that! Can I get your name and phone number?"

  AI: "I can help you with that! Can I get your name and phone number?"

Turn 2:
  User: "Sure, it's John Smith, 416-555-1234"

  System:
    1. STT: "Sure, it's John Smith, 416-555-1234"
    2. LangGraph:
       - Node: gather_customer_info
       - Variables: { ..., customer_name: 'John Smith', customer_phone: '416-555-1234' }
       - Tool call: customer_list({ query_search: '416-555-1234' })
       - Result: No customer found
       - Next: create_customer
    3. TTS: "Thanks John! What's your address?"

  AI: "Thanks John! What's your address?"

Turn 3:
  User: "123 Main Street, Toronto"

  System:
    1. STT: "123 Main Street, Toronto"
    2. LangGraph:
       - Node: create_customer
       - Variables: { ..., address: '123 Main Street', city: 'Toronto' }
       - Tool call: customer_create({ body_name: 'John Smith', body_primary_phone: '416-555-1234', body_primary_address: '123 Main Street', body_city: 'Toronto', body_province: 'ON' })
       - Result: { id: 'cust-uuid-123', ... }
       - Next: create_task
    3. TTS: "Got it! What's the plumbing issue?"

  AI: "Got it! What's the plumbing issue?"

Turn 4:
  User: "My kitchen sink is leaking"

  System:
    1. STT: "My kitchen sink is leaking"
    2. LangGraph:
       - Node: create_task
       - Variables: { ..., issue_description: 'Kitchen sink leaking' }
       - Tool call: task_create({ body_name: 'Kitchen sink repair', body_description: 'Leaking kitchen sink', body_task_type: 'service', body_priority: 'medium' })
       - Result: { id: 'task-uuid-456', ... }
       - Tool call: linkage_create({ body_parent_entity_type: 'customer', body_parent_entity_id: 'cust-uuid-123', body_child_entity_type: 'task', body_child_entity_id: 'task-uuid-456' })
       - Next: find_employee
    3. TTS: "I understand. When would you like someone to come?"

  AI: "I understand. When would you like someone to come?"

Turn 5:
  User: "Tomorrow morning if possible"

  System:
    1. STT: "Tomorrow morning if possible"
    2. LangGraph:
       - Node: find_employee
       - Variables: { ..., preferred_time: 'tomorrow morning' }
       - Tool call: employee_list({ query_role: 'plumber', query_status: 'active' })
       - Result: { rows: [{ id: 'emp-uuid-789', name: 'Mike Johnson', ... }], ... }
       - Tool call: booking_list({ query_employee_id: 'emp-uuid-789', query_date: '2025-11-07' })
       - Result: { rows: [], ... } (no conflicts)
       - Next: create_booking
    3. TTS: "I can schedule Mike Johnson for tomorrow at 9am. Does that work?"

  AI: "I can schedule Mike Johnson for tomorrow at 9am. Does that work?"

Turn 6:
  User: "Perfect!"

  System:
    1. STT: "Perfect!"
    2. LangGraph:
       - Node: create_booking
       - Tool call: booking_create({ body_title: 'Kitchen sink repair - John Smith', body_scheduled_start_datetime: '2025-11-07T09:00:00Z', body_scheduled_end_datetime: '2025-11-07T11:00:00Z', body_assigned_employee_id: 'emp-uuid-789' })
       - Result: { id: 'booking-uuid-101', ... }
       - Tool call: linkage_create({ body_parent_entity_type: 'task', body_parent_entity_id: 'task-uuid-456', body_child_entity_type: 'booking', body_child_entity_id: 'booking-uuid-101' })
       - Next: confirm
    3. TTS: "All set! Mike Johnson will arrive tomorrow at 9am to fix your kitchen sink. You'll receive a confirmation email shortly. Is there anything else?"

  AI: "All set! Mike Johnson will arrive tomorrow at 9am to fix your kitchen sink. You'll receive a confirmation email shortly. Is there anything else?"

Turn 7:
  User: "No, that's all. Thanks!"

  System:
    1. STT: "No, that's all. Thanks!"
    2. LangGraph:
       - Node: confirm
       - Evaluator: Workflow complete ✅
       - Status: completed
    3. TTS: "You're welcome! Have a great day!"

  AI: "You're welcome! Have a great day!"
  [Call ends]
```

**Database State After Workflow:**

```sql
-- Customer created
INSERT INTO app.d_customer (id, name, primary_phone, primary_address, city, province, country, cust_type, cust_status)
VALUES ('cust-uuid-123', 'John Smith', '416-555-1234', '123 Main Street', 'Toronto', 'ON', 'Canada', 'residential', 'active');

-- Task created
INSERT INTO app.d_task (id, name, description, task_type, priority, task_status)
VALUES ('task-uuid-456', 'Kitchen sink repair', 'Leaking kitchen sink', 'service', 'medium', 'pending');

-- Linkage: Customer → Task
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('customer', 'cust-uuid-123', 'task', 'task-uuid-456');

-- Booking created
INSERT INTO app.d_booking (id, title, scheduled_start_datetime, scheduled_end_datetime, assigned_employee_id, booking_status)
VALUES ('booking-uuid-101', 'Kitchen sink repair - John Smith', '2025-11-07 09:00:00', '2025-11-07 11:00:00', 'emp-uuid-789', 'scheduled');

-- Linkage: Task → Booking
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('task', 'task-uuid-456', 'booking', 'booking-uuid-101');

-- Orchestrator session (completed)
INSERT INTO app.d_orchestrator_session (session_id, current_intent, current_node, status, variables, turn_count, completed, conversation_ended)
VALUES ('session-uuid', 'CalendarBooking', 'confirm', 'completed', '{"service_type":"plumbing","customer_name":"John Smith",...}', 7, true, true);
```

### Example 2: Project Search (Text)

**Goal:** Employee searches for projects

```
User: "Show me all active kitchen renovation projects"

System:
  1. OpenAI Chat Completion with MCP tools
  2. AI decides: tool_call = project_list({ query_search: 'kitchen renovation', query_status: 'active' })
  3. MCP Adapter executes: GET /api/v1/project?search=kitchen+renovation&status=active
  4. API returns: { rows: [{ id, name, code, status, budget, ... }], count: 8 }
  5. AI formats response

AI: "I found 8 active kitchen renovation projects:

1. **PROJ-2025-001** - Downtown Condo Kitchen ($45,000) - 60% complete
2. **PROJ-2025-015** - Suburban Home Kitchen ($32,000) - 25% complete
3. **PROJ-2025-023** - Luxury Kitchen Remodel ($85,000) - 80% complete
...

Would you like details on any specific project?"
```

### Example 3: Off-Topic Handling (Voice)

**Goal:** Customer asks off-topic question

```
Turn 1:
  User: "What's the weather like today?"

  System:
    1. STT: "What's the weather like today?"
    2. LangGraph:
       - Node: critic
       - Detected: forbidden topic "weather"
       - Off-topic count: 1 → Warning
    3. TTS: "I'm specifically here to help you book a service appointment. Can we get back to scheduling your service?"

  AI: "I'm specifically here to help you book a service appointment. Can we get back to scheduling your service?"

Turn 2:
  User: "Ok sure, but first, who won the hockey game last night?"

  System:
    1. STT: "Ok sure, but first, who won the hockey game last night?"
    2. LangGraph:
       - Node: critic
       - Detected: forbidden topic "hockey" (sports)
       - Off-topic count: 2 → End conversation
       - Status: failed
    3. TTS: "I'm specifically designed to help with our home services bookings. For other questions, please visit our website or contact our general support line."

  AI: "I'm specifically designed to help with our home services bookings. For other questions, please visit our website or contact our general support line."
  [Call ends]
```

---

## 7. Critical Considerations When Building/Extending

### For Developers Building New Features

#### Adding a New API Endpoint

1. **Define endpoint in PMO API** (e.g., `apps/api/src/modules/foo/routes.ts`)
   ```typescript
   fastify.get('/foo', async (request, reply) => {
     // Implementation
   });
   ```

2. **Add to API Manifest** (`apps/mcp-server/src/api-manifest.ts`)
   ```typescript
   {
     name: 'foo_list',
     method: 'GET',
     path: '/api/v1/foo',
     description: 'List all foo items',
     requiresAuth: true,
     category: 'Foo',
     parameters: {
       query: {
         search: 'Search foo items by name',
         limit: 'Max results'
       }
     }
   }
   ```

3. **Rebuild MCP Server**
   ```bash
   cd apps/mcp-server
   pnpm run build
   ```

4. **Test with AI**
   ```bash
   # Text chat
   curl -X POST http://localhost:4000/api/v1/chat/message \
     -H "Content-Type: application/json" \
     -d '{"message": "List all foo items"}'

   # AI should call foo_list tool
   ```

**That's it!** No other changes needed. The MCP Adapter auto-loads the new endpoint.

#### Adding a New LangGraph Workflow

1. **Create intent graph definition** (`apps/api/src/modules/chat/orchestrator/intent-graphs/my-workflow.graph.ts`)
   ```typescript
   export const MyWorkflowGraph: IntentGraph = {
     name: 'MyWorkflow',
     description: 'My custom workflow',
     boundaries: {
       maxTurns: 15,
       forbiddenTopics: ['politics', 'religion']
     },
     nodes: [
       {
         name: 'step1',
         type: 'worker',
         systemInstructions: 'Collect information about X',
         requiredVariables: ['field1', 'field2'],
         transitions: {
           default: 'step2',
           error: 'entry'
         }
       },
       // ... more nodes
     ]
   };
   ```

2. **Create LangGraph implementation** (`apps/api/src/modules/chat/orchestrator/langgraph/my-workflow.langgraph.ts`)
   ```typescript
   export function createMyWorkflowGraph(mcpAdapter: MCPAdapterService) {
     const workflow = new StateGraph(OrchestratorStateAnnotation)
       .addNode('entry', entryNode)
       .addNode('critic', criticNode)
       .addNode('step1', workerNode)
       .addNode('step2', workerNode)
       .addNode('evaluator', evaluatorNode);

     workflow
       .addEdge(START, 'entry')
       .addEdge('entry', 'critic')
       .addEdge('critic', 'step1')
       .addEdge('step1', 'evaluator')
       .addConditionalEdges('evaluator', routeEvaluator);

     return workflow.compile({ checkpointer });
   }
   ```

3. **Register in orchestrator** (`apps/api/src/modules/chat/orchestrator/langgraph/langgraph-orchestrator.service.ts`)
   ```typescript
   private initializeGraphs() {
     const myWorkflowGraph = createMyWorkflowGraph(this.mcpAdapter);
     this.graphs.set('MyWorkflow', myWorkflowGraph);
   }
   ```

4. **Update intent detection** (if needed)
   ```typescript
   async detectIntent(message: string): Promise<string> {
     if (message.includes('book') || message.includes('appointment')) {
       return 'CalendarBooking';
     }
     if (message.includes('my custom keyword')) {
       return 'MyWorkflow';
     }
     return 'CalendarBooking'; // Default
   }
   ```

#### Modifying Customer Service Tools

**Use Case:** Need to add/remove tool categories for voice agents

**File:** `apps/api/src/modules/chat/mcp-adapter.service.ts`

```typescript
export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    categories: [
      'Project', 'Task', 'Employee', 'Customer',
      // Add new category
      'NewCategory',
      // Remove unwanted category
      // 'Artifact',
    ],
    excludeEndpoints: [
      // Add specific endpoints to exclude
      'dangerous_operation',
    ],
    maxTools: 60
  });
}
```

### Performance Considerations

1. **Voice Call Latency:**
   - STT (Whisper): ~500ms
   - LangGraph processing: ~1000-2000ms (depends on tool calls)
   - TTS: ~800ms
   - **Total:** ~2-3.5 seconds per turn

2. **Optimization Tips:**
   - Use `gpt-4-turbo-preview` for Critic/Evaluator (50% faster)
   - Limit MCP tools to 60 (reduces token overhead)
   - Cache frequently used API responses
   - Use `tts-1` instead of `tts-1-hd` for faster TTS

3. **Cost per Voice Call:**
   - STT (Whisper): $0.006 per minute
   - GPT-4 (Worker): ~$0.03-0.05 per turn (depends on tool usage)
   - TTS: $0.015 per 1000 characters
   - **Total:** ~$0.10-0.20 per 5-minute call

### Security Considerations

1. **RBAC Enforcement:** MCP tools respect JWT token permissions. Customers can only access their own data.

2. **Tool Safety:** Delete operations excluded from customer service tools to prevent accidental data loss.

3. **Input Validation:** All MCP tool parameters validated before API execution.

4. **Rate Limiting:** Consider adding rate limits to voice/chat endpoints:
   ```typescript
   fastify.register(require('@fastify/rate-limit'), {
     max: 20, // 20 requests
     timeWindow: '1 minute'
   });
   ```

5. **Audit Logging:** All MCP tool calls logged with user ID, timestamp, parameters:
   ```typescript
   console.log(`[MCP] ${userId} called ${toolName} with ${JSON.stringify(args)}`);
   ```

### Testing Strategies

1. **Unit Tests for MCP Adapter:**
   ```typescript
   describe('executeMCPTool', () => {
     it('should map parameters correctly', async () => {
       const result = await executeMCPTool(
         'project_list',
         { query_search: 'kitchen', query_limit: '10' },
         'test-token'
       );
       expect(result.rows).toBeDefined();
     });
   });
   ```

2. **Integration Tests for Voice Pipeline:**
   ```bash
   # Record test audio
   ffmpeg -f alsa -i default -t 5 test-audio.webm

   # Test STT
   curl -X POST http://localhost:4000/api/v1/chat/orchestrator/stt \
     -F "file=@test-audio.webm"

   # Test full pipeline
   curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
     -F "file=@test-audio.webm"
   ```

3. **LangGraph Workflow Tests:**
   ```typescript
   describe('CalendarBooking workflow', () => {
     it('should complete booking in 7 turns', async () => {
       const orchestrator = getLangGraphOrchestratorService();

       // Turn 1: Initial request
       let result = await orchestrator.processMessage({
         message: 'I need a plumber',
         authToken: 'test-token'
       });
       expect(result.currentNode).toBe('gather_customer_info');

       // Turn 2: Provide customer info
       result = await orchestrator.processMessage({
         sessionId: result.sessionId,
         message: 'John Smith, 416-555-1234',
         authToken: 'test-token'
       });
       expect(result.variables.customer_name).toBe('John Smith');

       // ... continue through all 7 turns
     });
   });
   ```

### Common Pitfalls

1. **Forgetting to add endpoint to manifest:** New API endpoints won't be available to AI unless added to `api-manifest.ts`.

2. **Hardcoding tool lists:** Always use `getCustomerServiceTools()` or `getAllPMOTools()` instead of hardcoding tool arrays.

3. **Missing auth token:** Voice/chat requests must include JWT token in `Authorization` header or as `authToken` parameter.

4. **Not handling async tool calls:** AI may call multiple tools in sequence. Ensure your workflow waits for each tool to complete.

5. **Ignoring checkpoints:** Always load existing checkpoint before processing new message, or you'll lose conversation context.

6. **Over-prompting worker agents:** Keep system instructions concise (<2000 chars). Long prompts increase latency and cost.

### Debugging Tools

```bash
# Watch API logs for MCP tool calls
tail -f logs/api.log | grep MCP

# Check orchestrator session state
psql -d pmo_db -c "SELECT * FROM app.d_orchestrator_session WHERE session_id='...';"

# Test MCP tool execution directly
node -e "
const { executeMCPTool } = require('./apps/api/src/modules/chat/mcp-adapter.service.js');
executeMCPTool('project_list', { query_search: 'kitchen' }, 'your-jwt-token')
  .then(console.log)
  .catch(console.error);
"

# Replay voice call from logs
grep "session-uuid" logs/api.log | grep "Voice AI calling MCP tool"
```

---

## Summary

The AI/MCP system provides a **complete, production-ready conversational AI platform** for the Huron Home Services PMO:

✅ **149 API endpoints** exposed as structured tools
✅ **Multi-agent orchestration** via LangGraph for complex workflows
✅ **Voice pipeline** with Whisper STT and OpenAI TTS
✅ **State persistence** via PostgreSQL checkpointing
✅ **RBAC enforcement** - AI respects user permissions
✅ **DRY architecture** - Single API manifest, auto-generated tools
✅ **Extensible** - Add endpoints/workflows without modifying core logic

**Key Files:**
- `apps/mcp-server/` - Standalone MCP server for Claude Desktop
- `apps/api/src/modules/chat/mcp-adapter.service.ts` - Tool converter & executor
- `apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts` - STT/TTS pipeline
- `apps/api/src/modules/chat/orchestrator/langgraph/` - Multi-agent workflows
- `apps/web/src/components/chat/ChatWidget.tsx` - Frontend UI

**Documentation:**
- This file: Complete architecture & design
- `CLAUDE.md`: Platform overview
- `docs/entity_design_pattern/universal_entity_system.md`: Entity patterns

**Status:** Production Ready ✅
