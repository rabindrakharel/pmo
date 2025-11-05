# AI Chat Widget with MCP Server Integration

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Status:** Production-Ready

## 1. Semantics & Business Context

### Purpose
AI-powered customer service chat widget with **text** and **voice** capabilities, integrated with the complete PMO API ecosystem via Model Context Protocol (MCP). Enables customers to interact naturally while the AI assistant accesses all 126+ API endpoints for comprehensive service delivery.

### Business Value
- **Automated Customer Service**: Handle inquiries, bookings, and service requests 24/7
- **Voice & Text Support**: Multi-modal interaction for accessibility
- **Full Platform Access**: AI can access projects, tasks, employees, bookings, services, and all business entities
- **Authenticated Operations**: All AI actions execute under authenticated user context with RBAC enforcement
- **Conversation Tracking**: Complete audit trail in `f_customer_interaction` table

### Key Capabilities
1. **Text Chat**: GPT-4-turbo with function calling → 50 MCP tools
2. **Voice Chat**: GPT-4o-realtime with audio streaming → 50 MCP tools
3. **Tool Execution**: Direct API calls via MCP adapter with JWT authentication
4. **Session Management**: Database-backed conversation history with retry logic for race conditions

---

## 2. Architecture & DRY Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│                                                                   │
│  ┌──────────────┐              ┌─────────────────────────────┐  │
│  │ ChatWidget   │──────────────│  Text Chat UI               │  │
│  │              │              │  - Message list              │  │
│  │              │              │  - Input field               │  │
│  │              │              │  - Send button               │  │
│  └──────┬───────┘              └─────────────────────────────┘  │
│         │                                                         │
│         │                      ┌─────────────────────────────┐  │
│         │                      │  Voice Chat UI               │  │
│         └──────────────────────│  - Microphone button         │  │
│                                │  - Status indicator          │  │
│                                │  - Audio playback            │  │
│                                └─────────────────────────────┘  │
└───────────────────────┬─────────────────────────┬───────────────┘
                        │                          │
                    HTTP POST                 WebSocket
                  (text messages)           (audio stream)
                        │                          │
┌───────────────────────┴──────────────────────────┴───────────────┐
│                        BACKEND (Fastify)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Chat Routes Module                          │ │
│  │                                                               │ │
│  │  POST /api/v1/chat/session/new    ─────┐                    │ │
│  │  POST /api/v1/chat/message              │                    │ │
│  │  WS   /api/v1/chat/voice/call          │                    │ │
│  └────────────────────┬───────────────────┬┴───────────────────┘ │
│                       │                   │                       │
│                       ▼                   ▼                       │
│         ┌──────────────────────┐  ┌──────────────────────┐       │
│         │ OpenAI Service       │  │ Voice Service        │       │
│         │ (Text Chat)          │  │ (Realtime Audio)     │       │
│         │                      │  │                      │       │
│         │ - GPT-4-turbo        │  │ - GPT-4o-realtime    │       │
│         │ - Function calling   │  │ - Audio streaming    │       │
│         │ - MCP tools          │  │ - MCP tools          │       │
│         └──────────┬───────────┘  └──────────┬───────────┘       │
│                    │                          │                   │
│                    └──────────────┬───────────┘                   │
│                                   ▼                               │
│                      ┌──────────────────────┐                     │
│                      │   MCP Adapter        │                     │
│                      │                      │                     │
│                      │ - Tool converter     │                     │
│                      │ - API executor       │                     │
│                      │ - JWT auth           │                     │
│                      └──────────┬───────────┘                     │
│                                 │                                 │
│                                 ▼                                 │
│                ┌────────────────────────────────┐                 │
│                │     API Manifest (126 tools)   │                 │
│                │                                │                 │
│                │  Categories:                   │                 │
│                │  - Project (15 endpoints)      │                 │
│                │  - Task (15 endpoints)         │                 │
│                │  - Customer (10 endpoints)     │                 │
│                │  - Employee (10 endpoints)     │                 │
│                │  - Service, Booking, etc       │                 │
│                │                                │                 │
│                │  Filtered to 50 tools for      │                 │
│                │  customer service context      │                 │
│                └────────────────┬───────────────┘                 │
│                                 │                                 │
│                                 ▼                                 │
│                    ┌──────────────────────┐                       │
│                    │  Authenticated API   │                       │
│                    │  Calls (axios)       │                       │
│                    └──────────┬───────────┘                       │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────┐
                    │   PostgreSQL         │
                    │                      │
                    │ - f_customer_        │
                    │   interaction        │
                    │ - Session data       │
                    │ - Conversation       │
                    │   history            │
                    └──────────────────────┘
```

### DRY Patterns

#### 1. **Single MCP Adapter for Both Chat Types**
```
mcp-adapter.service.ts
├── getMCPTools()              → Filter MCP tools by category
├── getCustomerServiceTools()  → Return 50 relevant tools
├── executeMCPTool()          → Execute any MCP tool with auth
└── endpointToOpenAITool()    → Convert API manifest to OpenAI format
```

**Benefit**: Text chat and voice chat use identical tool definitions and execution logic.

#### 2. **Format Converter Pattern**
```typescript
// OpenAI Chat Completions format (for text chat)
{
  type: 'function',
  function: {
    name: 'project_list',
    description: 'List all projects',
    parameters: { ... }
  }
}

// OpenAI Realtime API format (for voice chat)
{
  name: 'project_list',
  description: 'List all projects',
  parameters: { ... }
}

// Conversion:
convertMCPToolsToRealtimeFormat(mcpTools) {
  return mcpTools.map(tool => tool.function)
}
```

#### 3. **Retry with Exponential Backoff**
```typescript
// Session creation retry pattern
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    // Generate unique interaction number and create session
    const interactionNumber = await generateInteractionNumber();
    await createSession({ interactionNumber, ... });
    return { success: true };
  } catch (error) {
    if (error.code === '23505') { // Duplicate key
      await sleep(50 * (attempt + 1)); // Exponential backoff
      continue;
    }
    throw error;
  }
}
```

**Purpose**: Handles race conditions when multiple chat sessions start simultaneously.

---

## 3. Database, API & UI/UX Mapping

### Database Schema

**Table**: `app.f_customer_interaction`

```sql
CREATE TABLE app.f_customer_interaction (
  id uuid PRIMARY KEY,
  interaction_number text UNIQUE NOT NULL,  -- INT-YYYY-NNNNN
  interaction_type text NOT NULL,            -- 'chat'
  interaction_subtype text,                  -- 'inbound'
  channel text,                              -- 'live_chat'
  interaction_datetime timestamptz,
  customer_id uuid,
  customer_name text,
  customer_type text,                        -- 'residential'
  content_text jsonb,                        -- Chat messages array
  source_system text,                        -- 'ai_chat_widget'
  resolution_status text,                    -- 'open'|'resolved'|'abandoned'
  metadata jsonb,                            -- { user_agent, interaction_type: 'voice'|'text' }
  integration_metadata jsonb,                -- { referrer_url, customer_email }
  browser_user_agent text,
  sentiment_score numeric,
  sentiment_label text,
  duration_seconds integer,
  ai_analyzed boolean,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);
```

### API Endpoints

#### Text Chat
```
POST /api/v1/chat/session/new
Body: { customer_email, customer_name, referrer_url, metadata }
Response: { session_id, greeting, timestamp }

POST /api/v1/chat/message
Body: { session_id, message }
Response: { session_id, response, function_calls, tokens_used }
```

#### Voice Chat
```
WebSocket /api/v1/chat/voice/call?name=...&email=...&token=...
Messages:
  → { type: 'input_audio_buffer.append', audio: <base64> }
  ← { type: 'response.audio.delta', delta: <base64> }
  ← { type: 'response.audio_transcript.done', transcript: "..." }
```

### UI/UX Flow

```
┌─────────────────────────────────────┐
│ User clicks chat icon               │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ POST /session/new                   │
│ → Creates DB session                │
│ → Returns greeting message          │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ User chooses: Text or Voice         │
└──────┬──────────────┬────────────────┘
       │              │
   Text│              │Voice
       ▼              ▼
┌──────────────┐  ┌────────────────────┐
│ Type message │  │ Click voice button │
│ Click send   │  │ Speak into mic     │
└─────┬────────┘  └────┬───────────────┘
      │                │
      ▼                ▼
┌─────────────────────────────────────┐
│ AI processes with MCP tools         │
│ - Calls 50 available API endpoints  │
│ - Authenticated with user's JWT     │
│ - Returns structured response       │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ Response rendered in chat UI        │
│ - Text: Markdown formatted          │
│ - Voice: Audio playback + transcript│
└─────────────────────────────────────┘
```

---

## 4. Central Configuration & Middleware

### Auth Token Flow

```typescript
// Frontend: ChatWidget.tsx
const token = localStorage.getItem('auth_token');

// Text chat
fetch('/api/v1/chat/message', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Voice chat
new WebSocket(`${wsUrl}/chat/voice/call?token=${encodeURIComponent(token)}`);
```

### Backend Auth Extraction

```typescript
// voice.routes.ts
const authToken = (request.query?.token as string) ||
                 request.headers.authorization?.replace('Bearer ', '');

const voiceSession = new VoiceSession(socket, {
  sessionId, interactionSessionId, authToken  // ← Passed to MCP executor
});
```

### MCP Tool Configuration

**File**: `apps/api/src/modules/chat/mcp-adapter.service.ts`

```typescript
export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    categories: [
      'Project',
      'Task',
      'Customer',
      'Service',
      'Employee',
      'Booking',
    ],
    excludeEndpoints: [
      'auth_login',    // Users already authenticated
      'auth_logout',
      'customer_signup',
      'customer_signin',
    ],
    maxTools: 50  // Limit to avoid OpenAI token limits
  });
}
```

---

## 5. User Interaction Flow Examples

### Example 1: Text Chat - Book HVAC Service

```
User: "I need my furnace serviced"

AI (calls: get_available_services with category='HVAC')
  → Response: [{ id: '...', name: 'Furnace Maintenance', price: '$150' }]

AI: "I can help! Our furnace maintenance service is $150.
     When would you like to schedule it?"

User: "Next Tuesday at 2pm"

AI (calls: get_employee_availability with date='2025-11-12', category='HVAC')
  → Response: [{ id: 'emp-123', name: 'John Smith', available: true }]

AI: "Great! John Smith is available. May I have your name and address?"

User: "Sarah Johnson, 123 Main St, Toronto"

AI (calls: create_booking with all details)
  → Response: { booking_number: 'BK-2025-00042', success: true }

AI: "Perfect! Your booking is confirmed.
     Booking #: BK-2025-00042
     Service: Furnace Maintenance
     Date: Nov 12, 2025 at 2:00 PM
     Technician: John Smith"
```

### Example 2: Voice Chat - Check Project Status

```
User: (speaks) "What's the status of the downtown renovation project?"

AI (voice transcription via Whisper)
  → Transcript: "What's the status of the downtown renovation project?"

AI (calls: project_list with filters)
  → Response: [{ id: '...', name: 'Downtown Renovation', stage: 'In Progress' }]

AI (voice response)
  → Audio: "The downtown renovation project is currently in progress.
            Would you like more details about specific tasks?"

User: (speaks) "Yes, what tasks are pending?"

AI (calls: task_list with project_id and stage='pending')
  → Response: [{ name: 'Electrical Inspection', due: '2025-11-10' }, ...]

AI (voice response)
  → Audio: "There are 3 pending tasks. The most urgent is the
            electrical inspection due on November 10th."
```

---

## 6. Critical Considerations When Building

### For Developers Extending This System

#### 1. **Always Use MCP Adapter, Never Direct Function Calls**
```typescript
// ❌ WRONG
const result = await functionTools.create_booking(args);

// ✅ CORRECT
const result = await executeMCPTool('create_booking', args, authToken);
```

**Why**: MCP adapter ensures authenticated API calls with proper error handling.

#### 2. **Handle Race Conditions in Session Creation**
The retry logic in `conversation.service.ts:createSession()` is **critical**. Do not remove it. Multiple users clicking chat simultaneously will cause duplicate interaction numbers without retry.

#### 3. **Voice vs Text Tool Format Differences**
- **Text Chat**: Uses `ChatCompletionTool` format (with `type: 'function'` wrapper)
- **Voice Chat**: Uses unwrapped function definitions (just the `function` object)

Use `convertMCPToolsToRealtimeFormat()` to convert for voice.

#### 4. **Auth Token Must Be Passed**
Without auth token, MCP tools **fall back to legacy function tools** (only 3 tools). Verify token is present:
```typescript
if (!authToken) {
  console.warn('⚠️ No auth token - limited tool access');
}
```

#### 5. **Tool Limit is 50**
OpenAI has token limits for function definitions. The 126 MCP tools exceed this. The `maxTools: 50` parameter filters to customer-service-relevant tools only.

To adjust categories:
```typescript
getMCPTools({
  categories: ['Project', 'Task'],  // Customize as needed
  maxTools: 30                       // Lower limit if needed
});
```

#### 6. **Audio Format Must Be PCM16 @ 24kHz**
```typescript
// Frontend audio processing
const audioContext = new AudioContext({ sampleRate: 24000 });
const pcm16 = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
const base64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(pcm16.buffer))));
```

**Why**: OpenAI Realtime API requires PCM16. Wrong format = silent audio.

#### 7. **Voice Sessions Clean Up Automatically**
WebSocket disconnection triggers cleanup:
```typescript
clientWs.on('close', () => {
  this.cleanup();  // Closes OpenAI connection
});
```

No manual cleanup needed.

---

## Architecture Decision Records

### ADR-001: Why MCP Instead of Direct Function Tools?

**Decision**: Use MCP Server API manifest instead of hardcoded function tools.

**Rationale**:
- **Single Source of Truth**: API manifest already defines all 126 endpoints
- **Automatic Updates**: New API endpoints automatically available to AI
- **Consistency**: Same tools for text chat, voice chat, and MCP server clients
- **Maintainability**: No duplicate tool definitions to keep in sync

**Trade-offs**:
- Added complexity: MCP adapter layer
- Token limits: Can't use all 126 tools (limited to 50)

### ADR-002: Why 50 Tool Limit?

**Decision**: Filter MCP tools to 50 customer-service-relevant endpoints.

**Rationale**:
- OpenAI has ~16k token limit for system prompts + tools
- 126 tools ≈ 20k tokens (exceeds limit)
- Customer service needs: projects, tasks, bookings, services, employees, customers
- Admin tools: office management, role management → not needed for chat

**Implementation**: Exclude auth endpoints, include CRUD for relevant entities.

---

## Testing & Verification

### Test Text Chat
```bash
# 1. Create session
curl -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com","customer_name":"Test User"}'

# 2. Send message
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"session_id":"SESSION_ID","message":"What services do you offer?"}'
```

### Test Voice Chat
Open browser console on `http://localhost:5173`:
```javascript
// Click voice button, observe console logs
// Should see: "✅ OpenAI Realtime connected"
// Should see: "📡 Loading 50 MCP tools for voice agent"
```

### Verify MCP Tools Loaded
Check API logs for:
```
📡 Loading 50 MCP tools for voice agent
🔧 Voice AI calling MCP tool: project_list
📡 Executing MCP tool via API: project_list
```

---

## Files Modified

### Backend
```
apps/api/src/modules/chat/
├── mcp-adapter.service.ts          ← NEW: MCP tool converter & executor
├── openai.service.ts                ← MODIFIED: Added MCP integration
├── voice.service.ts                 ← MODIFIED: Added MCP tools for voice
├── voice.routes.ts                  ← MODIFIED: Pass auth token
├── routes.ts                        ← MODIFIED: Pass auth token to AI
└── conversation.service.ts          ← MODIFIED: Retry logic for race conditions
```

### Frontend
```
apps/web/src/components/chat/
└── ChatWidget.tsx                   ← MODIFIED: Pass token in WebSocket URL
```

### Total Changes
- **1 file created**: `mcp-adapter.service.ts`
- **5 files modified**: `openai.service.ts`, `voice.service.ts`, `voice.routes.ts`, `routes.ts`, `conversation.service.ts`, `ChatWidget.tsx`
- **~300 lines added**

---

## Performance & Scalability

### Current Capacity
- **Concurrent Sessions**: Limited by WebSocket connections (~10k per server)
- **Token Usage**: ~2k tokens per text message (with tool calls)
- **Audio Latency**: ~200-500ms for voice responses
- **Database Load**: 2-3 queries per message (read session, update session)

### Bottlenecks
1. **OpenAI API Rate Limits**: 10k requests/min (GPT-4), 50 requests/min (Realtime)
2. **Database Writes**: Session updates on every message
3. **WebSocket Connections**: Each voice session = 2 WebSockets (client→server, server→OpenAI)

### Optimization Recommendations
1. **Batch Session Updates**: Update DB every N messages instead of every message
2. **Cache Tool Definitions**: `getCustomerServiceTools()` result can be cached
3. **Connection Pooling**: Reuse WebSocket connections to OpenAI (not currently supported by API)

---

## Security Considerations

### Auth Token Transmission
- ✅ **Text Chat**: Bearer token in `Authorization` header (HTTPS)
- ✅ **Voice Chat**: Token in query param (WSS connection)
- ⚠️ **Query Param Logging**: Tokens may appear in server logs

**Recommendation**: Move token to WebSocket upgrade headers instead of query params.

### RBAC Enforcement
All MCP tool calls execute with user's JWT token → RBAC checked at API layer.

Example:
```
User with "view-only" role calls create_booking
→ executeMCPTool('create_booking', args, userToken)
→ API returns 403 Forbidden
→ AI responds: "I don't have permission to create bookings."
```

### SQL Injection Protection
All database queries use parameterized queries via `postgres` tagged templates:
```typescript
await client`INSERT INTO app.f_customer_interaction VALUES (${sessionId}, ...)`
```

---

## Monitoring & Logging

### Key Metrics to Track
1. **Session Creation Rate**: `f_customer_interaction.created_ts`
2. **Token Usage**: `total_tokens` column
3. **Function Call Success Rate**: `function_calls` JSONB array
4. **Voice Session Duration**: `duration_seconds`
5. **Sentiment Analysis**: `sentiment_score`, `sentiment_label`

### Log Patterns

**Successful Text Chat**:
```
✅ Created chat session: ca5138e6-...
🔧 Using MCP tools (50 tools available)
🤖 AI calling function: project_list
📡 Executing MCP tool: project_list
✅ Function project_list executed successfully
✅ Message processed for session ca5138e6: 1500 tokens, 1 function calls
```

**Successful Voice Chat**:
```
🎙️ New voice call connection
✅ Created chat session: 0d48fdd0-...
📡 Loading 50 MCP tools for voice agent
✅ OpenAI Realtime connected for session f3dd02f7-...
🎤 User said: What services do you offer?
🔧 Voice AI calling MCP tool: service_list
📡 Executing MCP tool via API: service_list
🤖 AI said: We offer HVAC, Plumbing, Electrical, Landscaping, and General Contracting...
```

---

## Future Enhancements

1. **Conversation Memory Across Sessions**
   - Store user preferences, previous bookings
   - "As discussed last time..." context

2. **Multi-Language Support**
   - Detect language from input
   - Respond in user's language

3. **Proactive Notifications**
   - "Your booking tomorrow at 2pm is confirmed"
   - Push to chat widget when user is on site

4. **Advanced Analytics**
   - Conversation flow visualization
   - Common question detection
   - Booking conversion funnel

5. **Human Handoff**
   - "Transfer to agent" function
   - Escalate complex issues to support team

---

## Troubleshooting Guide

### Issue: "Failed to start chat" Error
**Cause**: Duplicate interaction number race condition
**Solution**: Retry mechanism handles this automatically (up to 5 attempts)
**Verification**: Check logs for `⚠️ Duplicate interaction number on attempt X, retrying...`

### Issue: Voice chat connects but no audio
**Cause 1**: Microphone permission denied
**Solution**: Browser will prompt - user must allow

**Cause 2**: Wrong audio format
**Verification**: Check console for audio processing errors
**Solution**: Verify PCM16 @ 24kHz encoding

### Issue: AI has limited tools (only 3)
**Cause**: Auth token not passed
**Verification**: Check logs for `⚠️ No auth token, using legacy tools`
**Solution**: Verify `authToken` is passed to `getAIResponse()` and `VoiceSession()`

### Issue: "Tool not found" Error
**Cause**: MCP tool name mismatch with API manifest
**Solution**: Verify tool name exists in `apps/mcp-server/src/api-manifest.ts`

---

## References

- **OpenAI Chat Completions**: https://platform.openai.com/docs/guides/function-calling
- **OpenAI Realtime API**: https://platform.openai.com/docs/guides/realtime
- **Model Context Protocol**: https://modelcontextprotocol.io
- **MCP Server Implementation**: `apps/mcp-server/src/index.ts`
- **API Manifest**: `apps/mcp-server/src/api-manifest.ts`
