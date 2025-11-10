# AI Chat System - Complete Documentation

> **Goal-Oriented Conversational AI Platform** - Multi-modal customer service system with text chat, voice calling, and automated operations

**Version:** 6.0.0 (MCP-Driven Session Memory)
**Last Updated:** 2025-11-10
**Status:** Production

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Configuration](#configuration)
6. [Database Schema](#database-schema)
7. [Key Features](#key-features)
8. [Data Flow](#data-flow)
9. [MCP Integration](#mcp-integration)
10. [Usage Guide](#usage-guide)
11. [Performance & Cost](#performance--cost)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

The **AI Chat System** is an enterprise-grade conversational AI platform that provides both text and voice customer service channels with automated booking, task creation, and customer management.

### Core Capabilities

- **Multi-modal Communication**: Text chat (SSE streaming) + Voice calls (WebSocket + HTTP)
- **Goal-Oriented Workflow**: 6-stage customer service journey (Greetings → Data Collection → Solution Design → Execution → Confirmation)
- **MCP-Driven Automation**: 60+ API endpoints exposed as function tools for customer/task/calendar operations
- **Session Memory**: LowDB-based persistent context with deep merge and atomic locking
- **Streaming Responses**: Token-by-token text streaming + sentence-level voice streaming
- **Agent Orchestration**: Unified goal agent with conversational + MCP capabilities

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **LLM** | OpenAI GPT-4o mini (temp: 0.1, max tokens: 500) |
| **Speech-to-Text** | Deepgram Nova-2 |
| **Text-to-Speech** | ElevenLabs (eleven_flash_v2_5, 6 voices) |
| **Backend** | Fastify v5, TypeScript (ESM), PostgreSQL 14+ |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **Session Storage** | LowDB (JSON file: `logs/contexts/session_memory_data.db.json`) |
| **Queue** | RabbitMQ (optional) |
| **Real-time** | WebSocket (voice), Server-Sent Events (text) |
| **Authentication** | JWT |

### Key Metrics

| Metric | Value |
|--------|-------|
| **Text Response Time** | First token: ~200-500ms |
| **Voice Response Time** | First audio: ~1 second |
| **Goals** | 6 (WARM_GREETINGS → ELICIT_INFO → LOOKUP → DESIGN → EXECUTE → CONFIRM) |
| **Backend LOC** | ~13,456 lines (orchestrator + services) |
| **Frontend Components** | 4 (ChatWidget, VoiceChat, 2 pages) |
| **MCP Tools** | 60+ API endpoints |
| **Database Tables** | 4 (session, state, agent log, summary) |

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                              │
│  ┌──────────────────────┐    ┌───────────────────────┐          │
│  │  ChatWidget.tsx      │    │  VoiceChat.tsx        │          │
│  │  - Text chat UI      │    │  - Push-to-talk UI    │          │
│  │  - WebSocket voice   │    │  - HTTP voice API     │          │
│  │  - SSE streaming     │    │  - 6 voice options    │          │
│  └──────────┬───────────┘    └───────────┬───────────┘          │
└─────────────┼────────────────────────────┼──────────────────────┘
              │                            │
              ▼ HTTP/WS                    ▼ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│  ┌──────────────────────┐    ┌───────────────────────┐          │
│  │  routes.ts           │    │  voice-orchestrator.  │          │
│  │  - Session mgmt      │    │    routes.ts          │          │
│  │  - Text streaming    │    │  - WebSocket voice    │          │
│  │  - Agent endpoints   │    │  - HTTP voice         │          │
│  └──────────┬───────────┘    └───────────┬───────────┘          │
└─────────────┼────────────────────────────┼──────────────────────┘
              │                            │
              ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION LAYER                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Agent Orchestrator Service                              │  │
│  │  - Goal-oriented workflow management                     │  │
│  │  - Unified goal agent execution                          │  │
│  │  - Streaming support (text + voice)                      │  │
│  │  - Goal transition engine (deterministic + semantic)     │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ├──→ Unified Goal Agent                   │
│                       │    (Conversational + MCP tools)         │
│                       │                                          │
│                       ├──→ Voice Orchestrator                   │
│                       │    (Deepgram STT + ElevenLabs TTS)      │
│                       │                                          │
│                       ├──→ Goal Transition Engine               │
│                       │    (Hybrid branching: determinist +     │
│                       │     semantic routing)                   │
│                       │                                          │
│                       └──→ Session Memory Data Service          │
│                            (LowDB + deep merge + locking)       │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐      │
│  │ OpenAI   │  │ Deepgram │  │ElevenLabs│  │ MCP Server │      │
│  │ GPT-4o   │  │ Nova-2   │  │ Flash    │  │ (60+ tools)│      │
│  │ mini     │  │ (STT)    │  │ v2.5(TTS)│  │            │      │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘      │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │ PostgreSQL   │  │  LowDB       │  │ RabbitMQ       │        │
│  │ - Sessions   │  │  - Session   │  │ (optional)     │        │
│  │ - Agent logs │  │    memory    │  │ - Queue        │        │
│  │ - State      │  │    (JSON)    │  │   management   │        │
│  └──────────────┘  └──────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Evolution

**v6.0 (Current):** MCP-Driven Session Memory
- Agents use MCP tools to update session memory
- Deep merge for nested data structures
- Atomic locking per session
- LowDB JSON storage

**v5.0:** Unified Goal Agent
- Single LLM session per goal (conversational + MCP)
- Eliminated sequential agent calls
- Improved response coherence

**v4.0:** Fast Semantic Routing
- GPT-4o mini for yes/no condition evaluation
- Hybrid branching (deterministic + semantic)

**v3.0:** Goal-Oriented Architecture
- Replaced 17-node state machine with 6 business goals
- Declarative configuration in `agent_config.json`

---

## 💾 Backend Implementation

### File Structure

```
/home/user/pmo/apps/api/src/modules/chat/
├── routes.ts                                    # Text chat API routes
├── conversation.service.ts                      # Session persistence
├── mcp-adapter.service.ts                       # API → OpenAI tools conversion
├── orchestrator/
│   ├── agent_config.json                        # 🎯 Declarative goal configuration (743 lines)
│   ├── agents/
│   │   ├── agent-orchestrator.service.ts        # Main coordinator (1,200+ lines)
│   │   └── unified-goal-agent.service.ts        # Goal execution (conversational + MCP)
│   ├── engines/
│   │   └── goal-transition.engine.ts            # Hybrid branching logic
│   ├── services/
│   │   ├── openai.service.ts                    # LLM wrapper (streaming support)
│   │   ├── session-memory-data.service.ts       # LowDB CRUD + locking
│   │   └── llm-logger.service.ts                # LLM call tracking
│   ├── config/
│   │   ├── agent-config.schema.ts               # TypeScript types
│   │   ├── agent-models.config.ts               # Model configs (temp, tokens)
│   │   └── engaging-messages.config.ts          # Greeting templates
│   ├── mcp/
│   │   └── session-memory-data-mcp.tools.ts     # MCP tools for session memory
│   ├── voice-orchestrator.service.ts            # Deepgram + ElevenLabs integration
│   └── voice-langraph.routes.ts                 # WebSocket voice endpoint
└── session-memory-data.routes.ts                # Session memory data API
```

### Key Services

#### 1. Agent Orchestrator Service
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

**Responsibilities:**
- Coordinate goal-oriented workflow
- Manage session state (current goal, context, conversation history)
- Execute unified goal agents
- Evaluate goal transitions (deterministic + semantic)
- Stream responses (text token-by-token)

**Key Methods:**

```typescript
// Process message with streaming
async *processMessageStream(args: {
  sessionId: string;
  chatSessionId: string;
  userId: string;
  message: string;
}): AsyncGenerator<StreamChunk>

// Process message (blocking)
async processMessage(args: {...}): Promise<{
  response: string;
  sessionId: string;
  currentNode: string;
  conversationEnded: boolean;
}>
```

**Workflow:**
1. Load/initialize session state
2. Execute unified goal agent for current goal
3. Update session memory via MCP tools (automatic)
4. Check goal transition conditions (hybrid branching)
5. Transition to next goal if criteria met
6. Save state to database
7. Return/stream response

#### 2. Unified Goal Agent
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/agents/unified-goal-agent.service.ts`

**Purpose:** Single agent that handles both conversational responses AND MCP tool execution within one LLM session.

**Advantages:**
- Better conversation coherence (no context switching)
- Lower latency (single LLM call instead of sequential calls)
- Automatic tool enrichment (append context to API calls)

**Streaming Flow:**
```typescript
async *executeGoalStream(goalId, state, userMessage) {
  // 1. Build system prompt with:
  //    - Agent profile (identity, capabilities)
  //    - Goal description + success criteria
  //    - Conversation tactics
  //    - Available MCP tools
  //    - Session memory context

  // 2. Call OpenAI with tools (streaming)
  for await (const chunk of openaiService.callAgentStream({
    messages: [...conversationHistory, { role: 'user', content: userMessage }],
    tools: mcpTools,  // 60+ API endpoints
    temperature: 0.1,
    maxTokens: 500
  })) {
    // 3. If tool call:
    if (chunk.toolCall) {
      const result = await executeMCPTool(chunk.toolCall);
      yield { type: 'tool', result };
      // Continue streaming with tool result
    } else {
      // 4. Stream text tokens
      yield { type: 'token', token: chunk.token };
    }
  }
}
```

#### 3. Voice Orchestrator Service
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts`

**Pipeline:**
```
User Audio (WAV/WebM) → Deepgram STT → Text Transcript
                                          ↓
                              Agent Orchestrator (streaming)
                                          ↓
                              Token-by-token response
                                          ↓
                              Sentence Buffering (wait for . ! ?)
                                          ↓
                              ElevenLabs TTS → Audio chunk (MP3)
                                          ↓
                              Stream to client → Progressive playback
```

**Key Methods:**

```typescript
// Speech-to-Text
async speechToText(audioBuffer: Buffer, audioFormat: string): Promise<string> {
  // Deepgram Nova-2 API call
  // Returns transcript with smart formatting
}

// Text-to-Speech
async textToSpeech(text: string, voice: string): Promise<Buffer> {
  // ElevenLabs Flash v2.5 API call
  // Returns MP3 audio buffer
  // Latency: ~75ms per chunk
}

// Streaming voice processing
async *processVoiceMessageStream(
  audioBuffer: Buffer,
  state: AgentContextState,
  args: VoiceProcessArgs
): AsyncGenerator<VoiceChunk> {
  // 1. STT: Audio → text
  const transcript = await this.speechToText(audioBuffer, 'wav');

  // 2. Stream agent response
  let textBuffer = '';
  for await (const chunk of orchestrator.processMessageStream({
    message: transcript,
    ...args
  })) {
    if (chunk.type === 'token') {
      textBuffer += chunk.token;

      // 3. Buffer until sentence boundary
      if (hasSentenceBoundary(textBuffer) || textBuffer.length > 100) {
        // 4. Convert to speech
        const audio = await this.textToSpeech(textBuffer, voice);

        // 5. Yield audio chunk
        yield { type: 'audio.chunk', audio, transcript: textBuffer };
        textBuffer = '';
      }
    }
  }

  // 6. Flush remaining buffer
  if (textBuffer) {
    const audio = await this.textToSpeech(textBuffer, voice);
    yield { type: 'audio.chunk', audio, transcript: textBuffer };
  }
}
```

**Voice Settings:**
```typescript
{
  model_id: 'eleven_flash_v2_5',  // Fastest model (~75ms latency)
  voice_settings: {
    stability: 0.8,              // Voice consistency
    similarity_boost: 0.8,       // Match original voice
    style: 0.0,                  // Neutral (0.0), expressive (1.0)
    use_speaker_boost: true
  },
  output_format: 'mp3_44100_128'
}
```

**Available Voices:**
- `nova` (female, energetic) - Default
- `alloy` (male, neutral)
- `echo` (male, crisp)
- `fable` (male, warm)
- `onyx` (male, deep)
- `shimmer` (female, soft)

#### 4. MCP Adapter Service
**File:** `/home/user/pmo/apps/api/src/modules/chat/mcp-adapter.service.ts`

**Purpose:** Convert API manifest to OpenAI function tools

**Features:**
- Converts 100+ API endpoints to function tools
- Filters by category (Customer, Task, Employee, Calendar, Settings)
- Dynamic parameter extraction (path, query, body)
- Tool enrichment (auto-append context to descriptions)

**Example Conversion:**

```typescript
// API endpoint
POST /api/v1/customer
Body: { name, phone, email, address }

// Becomes OpenAI function tool:
{
  type: 'function',
  function: {
    name: 'customer_create',
    description: 'Create a new customer profile. Auto-generates customer code and cust_number.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name' },
        phone: { type: 'string', description: 'Phone number (format: +1234567890)' },
        email: { type: 'string', description: 'Email address' },
        address: { type: 'string', description: 'Full address (street, city, province, postal)' }
      },
      required: ['name', 'phone']
    }
  }
}
```

**Tool Enrichment:**
```typescript
// Auto-append task context from session memory
task_create({
  title: "Roof repair",
  description: "..." // Automatically enriched with customer info
})

// Becomes:
{
  title: "Roof repair",
  description: "Customer: John Smith (555-1234)\nAddress: 123 Main St\nRequest: Roof hole repair\n\n..."
}
```

#### 5. Session Memory Data Service
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/services/session-memory-data.service.ts`

**Purpose:** LowDB-based session memory with atomic operations

**Features:**
- Per-session locking (prevents race conditions)
- Deep merge for nested updates (preserves existing fields)
- File storage: `logs/contexts/session_memory_data.db.json`
- RabbitMQ queue support (optional)

**Data Structure:**
```typescript
interface SessionMemoryData {
  customer: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    cust_id?: string;
    existing_customer_flag?: boolean;
  };
  service: {
    primary_request?: string;
    urgency?: string;
    service_category?: string;
  };
  operations: {
    solution_plan?: string;
    task_id?: string;
    employee_id?: string;
    employee_name?: string;
  };
  project?: {
    project_id?: string;
    project_name?: string;
  };
  assignment?: {
    appointment_id?: string;
    appointment_time?: string;
  };
}
```

**Key Methods:**

```typescript
// Get session memory
async getSessionMemory(sessionId: string): Promise<SessionMemoryData>

// Update session memory (deep merge)
async updateSessionMemory(
  sessionId: string,
  updates: Partial<SessionMemoryData>
): Promise<SessionMemoryData>

// Get specific field
async getSessionField(sessionId: string, path: string): Promise<any>

// Set specific field
async setSessionField(sessionId: string, path: string, value: any): Promise<void>
```

**Deep Merge Example:**
```typescript
// Existing memory:
{
  customer: { name: "John" },
  service: { primary_request: "Roof repair" }
}

// Update:
await updateSessionMemory(sessionId, {
  customer: { phone: "555-1234" }  // Add phone, preserve name
});

// Result:
{
  customer: { name: "John", phone: "555-1234" },  // ✅ Merged
  service: { primary_request: "Roof repair" }      // ✅ Preserved
}
```

#### 6. Goal Transition Engine
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/engines/goal-transition.engine.ts`

**Purpose:** Evaluate goal completion and determine next goal

**Hybrid Branching:**

```typescript
async evaluateTransition(
  currentGoal: string,
  context: DAGContext,
  conversationHistory: Array<{ customer: string; agent: string }>
): Promise<{
  shouldTransition: boolean;
  nextGoal?: string;
  reason?: string;
}>
```

**Evaluation Order:**

1. **Deterministic Conditions** (instant, ~1ms):
   ```json
   {
     "condition": {
       "json_path": "customer.phone",
       "operator": "is_set"
     },
     "next_goal": "DESIGN_SOLUTION"
   }
   ```
   - Checks: `is_set`, `is_empty`, `==`, `!=`, `>`, `<`, `>=`, `<=`
   - No LLM call required
   - Zero cost

2. **Semantic Conditions** (fast LLM, ~200-500ms):
   ```json
   {
     "condition": "Customer has confirmed they want to proceed with booking",
     "next_goal": "EXECUTE_SOLUTION"
   }
   ```
   - Uses GPT-4o mini with binary decision prompt
   - Limited to 150 tokens for speed
   - Returns: `{ result: boolean, confidence: number, reasoning: string }`
   - Cost: ~$0.0002 per evaluation

**Priority Ordering:**
```json
{
  "goal_branching_condition": {
    "type": "hybrid",
    "rules": [
      {
        "priority": 100,
        "condition": { "json_path": "operations.task_id", "operator": "is_set" },
        "next_goal": "CONFIRM_RESOLUTION"
      },
      {
        "priority": 50,
        "condition": "Customer confirmed booking details",
        "next_goal": "EXECUTE_SOLUTION"
      },
      {
        "priority": 10,
        "condition": "Customer is expressing hesitation",
        "next_goal": "ADDRESS_CONCERNS"
      }
    ]
  }
}
```
**Evaluation:** Checks rules in priority order, returns first match.

---

## 🎨 Frontend Implementation

### File Structure

```
/home/user/pmo/apps/web/src/
├── components/chat/
│   ├── ChatWidget.tsx       # Main text + voice chat component (804 lines)
│   └── VoiceChat.tsx        # Standalone push-to-talk voice (408 lines)
└── pages/
    ├── ChatPage.tsx         # Full-page chat interface
    └── VoiceChatPage.tsx    # Full-page voice interface
```

### 1. ChatWidget Component
**File:** `/home/user/pmo/apps/web/src/components/chat/ChatWidget.tsx`

**Features:**
- ✅ Text chat with SSE streaming
- ✅ Integrated voice calling (WebSocket)
- ✅ Session management
- ✅ Voice Activity Detection (VAD)
- ✅ Audio queue for sequential playback
- ✅ Microphone permission handling
- ✅ Minimizable widget

**Text Chat Flow:**
```typescript
// 1. User sends message
const sendMessage = async (message: string) => {
  setMessages([...messages, { role: 'user', content: message }]);

  // 2. Call streaming API
  const eventSource = new EventSource(
    `/api/v1/chat/message/stream`,
    { method: 'POST', body: JSON.stringify({ session_id, message }) }
  );

  // 3. Receive token stream
  eventSource.onmessage = (event) => {
    const { type, token, response } = JSON.parse(event.data);

    if (type === 'token') {
      // Append token to current message
      updateLastMessage((prev) => prev + token);
    } else if (type === 'done') {
      // Message complete
      setMessages([...messages, { role: 'assistant', content: response }]);
    }
  };
};
```

**Voice Call Flow:**
```typescript
// 1. Start voice call
const startVoiceCall = async () => {
  const ws = new WebSocket(`ws://api/v1/chat/voice/call?token=${token}`);

  // 2. Get microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);

  // 3. Send audio chunks
  mediaRecorder.ondataavailable = (event) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result.split(',')[1];
      ws.send(JSON.stringify({
        type: 'audio.append',
        audio: base64Audio
      }));
    };
    reader.readAsDataURL(event.data);
  };

  // 4. Detect silence → commit audio
  const vad = new VoiceActivityDetector();
  vad.onSilence(() => {
    ws.send(JSON.stringify({ type: 'audio.commit' }));
  });

  // 5. Receive audio responses
  ws.onmessage = (event) => {
    const { type, audio, transcript } = JSON.parse(event.data);

    if (type === 'audio.chunk') {
      // Queue audio for playback
      audioQueue.push({ audio: base64ToArrayBuffer(audio), transcript });
      playNextAudio();
    }
  };
};

// 6. Sequential audio playback
const playNextAudio = async () => {
  if (isPlaying || audioQueue.length === 0) return;

  isPlaying = true;
  const { audio, transcript } = audioQueue.shift();

  // Create audio context
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(audio);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // Play audio
  source.start(0);
  source.onended = () => {
    isPlaying = false;
    playNextAudio();  // Play next in queue
  };
};
```

**Voice Call UI:**
```tsx
{isVoiceCallActive && (
  <div className="voice-call-banner">
    <Phone className="icon-phone" />
    <span>Voice Call Active</span>
    <div className="status-indicator">
      {voiceStatus === 'listening' && <Mic className="listening" />}
      {voiceStatus === 'processing' && <Loader className="processing" />}
      {voiceStatus === 'speaking' && <Volume2 className="speaking" />}
    </div>
    <button onClick={endVoiceCall}>
      <PhoneOff />
    </button>
  </div>
)}
```

### 2. VoiceChat Component
**File:** `/home/user/pmo/apps/web/src/components/chat/VoiceChat.tsx`

**Features:**
- ✅ Push-to-talk interface (hold button to record)
- ✅ HTTP POST endpoint (simpler than WebSocket)
- ✅ Voice selection dropdown (6 voices)
- ✅ Audio recording (WebM format)
- ✅ Response playback with status indicators
- ✅ Conversation transcript display

**Push-to-Talk Flow:**
```typescript
// 1. User holds button → start recording
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

  chunks = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.start();

  setRecordingStatus('recording');
};

// 2. User releases button → stop recording
const stopRecording = async () => {
  mediaRecorder.stop();
  setRecordingStatus('processing');

  mediaRecorder.onstop = async () => {
    // 3. Convert to blob
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });

    // 4. Send to API
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('voice', selectedVoice);
    formData.append('session_id', sessionId);

    const response = await fetch('/api/v1/chat/orchestrator/voice', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    // 5. Get audio response
    const audioResponse = await response.blob();

    // 6. Play audio
    const audioUrl = URL.createObjectURL(audioResponse);
    const audio = new Audio(audioUrl);
    audio.play();

    setRecordingStatus('playing');
    audio.onended = () => setRecordingStatus('idle');
  };
};
```

**Voice Selection UI:**
```tsx
<select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
  <option value="nova">Nova (Female, Energetic)</option>
  <option value="alloy">Alloy (Male, Neutral)</option>
  <option value="echo">Echo (Male, Crisp)</option>
  <option value="fable">Fable (Male, Warm)</option>
  <option value="onyx">Onyx (Male, Deep)</option>
  <option value="shimmer">Shimmer (Female, Soft)</option>
</select>
```

---

## ⚙️ Configuration

### 1. Agent Configuration
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/agent_config.json` (743 lines)

**Structure:**
```json
{
  "version": "3.0.0",
  "architecture": "goal-oriented-agentic",

  "goals": [
    {
      "goal_id": "WARM_GREETINGS_EMPATHY_UNDERSTAND",
      "description": "Welcome customer and understand their needs",
      "primary_agent": "conversational_agent",
      "goal_success_criteria": {
        "evaluation_mode": "hybrid",
        "mandatory_fields": ["service.primary_request"]
      },
      "conversation_tactics": ["empathetic_listening", "rapport_building"],
      "max_turns": 5,
      "goal_branching_condition": {
        "type": "hybrid",
        "rules": [
          {
            "priority": 10,
            "condition": { "json_path": "service.primary_request", "operator": "is_set" },
            "next_goal": "ELICIT_STRUCTURED_INFO"
          }
        ]
      }
    },
    // ... 5 more goals
  ],

  "agent_profiles": {
    "conversational_agent": {
      "agent_name": "Huron Home Services Assistant",
      "agent_identity": "Empathetic customer service representative",
      "capabilities": [
        "Understanding customer needs",
        "Collecting contact information",
        "Booking appointments",
        "Creating service tasks"
      ],
      "system_prompt_template": "You are {{agent_name}}. {{agent_identity}}..."
    },
    "mcp_agent": {
      "agent_name": "Operations Agent",
      "capabilities": [
        "Customer lookup and creation",
        "Task management",
        "Calendar booking",
        "Settings queries"
      ]
    }
  },

  "conversation_tactics": {
    "empathetic_listening": {
      "description": "Show understanding and empathy",
      "examples": [
        "I understand that must be frustrating",
        "Let me help you with that right away"
      ]
    },
    "clarifying_questions": {
      "description": "Ask specific questions to gather information",
      "examples": [
        "Could you tell me more about...",
        "What would be the best time for you?"
      ]
    }
  },

  "global_constraints": {
    "max_conversation_turns": 30,
    "timeout_minutes": 15
  }
}
```

**6 Goals Workflow:**

1. **WARM_GREETINGS_EMPATHY_UNDERSTAND**
   - Welcome customer with empathy
   - Understand primary service request
   - Success: `service.primary_request` is set

2. **ELICIT_STRUCTURED_INFO**
   - Collect customer contact information
   - Fields: phone, name, email, address
   - Success: `customer.phone` is set

3. **LOOKUP_UPDATE_CREATE_RECORDS**
   - Search for existing customer by phone
   - Create new customer if not found
   - Success: `customer.cust_id` is set

4. **DESIGN_SOLUTION**
   - Create solution plan
   - Assign employee/technician
   - Success: `operations.solution_plan` and `operations.employee_id` are set

5. **EXECUTE_SOLUTION**
   - Create service task
   - Book appointment on employee calendar
   - Success: `operations.task_id` and `assignment.appointment_id` are set

6. **CONFIRM_RESOLUTION**
   - Verify customer satisfaction
   - Summarize actions taken
   - Close conversation

### 2. Model Configuration
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/config/agent-models.config.ts`

```typescript
export const agentModelConfig = {
  conversational_agent: {
    model: 'gpt-4o-mini',
    temperature: 0.1,         // Low for consistency
    maxTokens: 500,           // Concise responses
    costPer1KTokens: 0.0004,
    rationale: 'Empathetic customer service responses'
  },

  mcp_agent: {
    model: 'gpt-4o-mini',
    temperature: 0.1,         // Very low for deterministic tool selection
    maxTokens: 300,
    costPer1KTokens: 0.0004,
    rationale: 'Accurate MCP tool parameter extraction'
  },

  decision_engine: {
    model: 'gpt-4o-mini',
    temperature: 0.1,         // Low for binary decisions
    maxTokens: 150,           // Fast yes/no evaluation
    costPer1KTokens: 0.0004,
    rationale: 'Fast semantic condition evaluation'
  }
};
```

### 3. Environment Variables

```bash
# OpenAI (LLM)
OPENAI_API_KEY=sk-...

# Deepgram (Speech-to-Text)
DEEPGRAM_API_KEY=...

# ElevenLabs (Text-to-Speech)
ELEVEN_LABS_API_KEY=...
ELEVEN_LABS_VOICE_ID=nova               # Default voice
ELEVEN_LABS_MODEL_ID=eleven_flash_v2_5  # Fastest model
ELEVEN_LABS_STABILITY=0.8               # Voice consistency
ELEVEN_LABS_SIMILARITY=0.8              # Match original voice
ELEVEN_LABS_STYLE=0.0                   # Neutral (0.0), expressive (1.0)

# Logging
VERBOSE_AGENT_LOGS=false                # Enable detailed agent logs
```

---

## 🗄️ Database Schema

### Tables

**1. orchestrator_session**
**File:** `/home/user/pmo/db/60_orchestrator_session.ddl`

```sql
CREATE TABLE app.orchestrator_session (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_number SERIAL,
  chat_session_id UUID,                 -- FK to f_customer_interaction
  user_id UUID,
  current_intent VARCHAR(100),
  current_node VARCHAR(100),            -- Current goal ID
  status VARCHAR(50),                   -- 'active', 'completed', 'abandoned'
  session_context JSONB,                -- Session memory (DAGContext)
  conversation_summary JSONB,           -- Array of { customer, agent }
  agent_calls INT DEFAULT 0,            -- Total LLM calls
  mcp_calls INT DEFAULT 0,              -- Total MCP tool calls
  tokens_used INT DEFAULT 0,            -- Total tokens
  cost_cents DECIMAL(10,2) DEFAULT 0,   -- Total cost
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**2. orchestrator_state**
**File:** `/home/user/pmo/db/61_orchestrator_state.ddl`

```sql
CREATE TABLE app.orchestrator_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES app.orchestrator_session(session_id),
  key VARCHAR(255),                     -- State key (e.g., 'customer.phone')
  value JSONB,                          -- State value
  value_type VARCHAR(50),               -- 'string', 'number', 'boolean', 'object', 'array'
  source VARCHAR(100),                  -- 'extraction', 'mcp', 'user'
  validated BOOLEAN DEFAULT false,      -- Validation status
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestrator_state_session ON app.orchestrator_state(session_id);
CREATE INDEX idx_orchestrator_state_key ON app.orchestrator_state(key);
```

**3. orchestrator_agent_log**
**File:** `/home/user/pmo/db/62_orchestrator_agent_log.ddl`

```sql
CREATE TABLE app.orchestrator_agent_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES app.orchestrator_session(session_id),
  agent_type VARCHAR(100),              -- 'conversational_agent', 'mcp_agent'
  action VARCHAR(100),                  -- 'goal_execution', 'mcp_call', 'transition'
  goal_id VARCHAR(100),                 -- Current goal
  llm_model VARCHAR(100),               -- 'gpt-4o-mini'
  llm_prompt_tokens INT,
  llm_completion_tokens INT,
  llm_total_tokens INT,
  llm_cost_cents DECIMAL(10,4),
  mcp_tool_name VARCHAR(100),           -- MCP tool called (if applicable)
  mcp_tool_params JSONB,                -- Tool parameters
  mcp_tool_result JSONB,                -- Tool result
  latency_ms INT,                       -- Action latency
  metadata JSONB,                       -- Additional metadata
  created_ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestrator_agent_log_session ON app.orchestrator_agent_log(session_id);
CREATE INDEX idx_orchestrator_agent_log_agent ON app.orchestrator_agent_log(agent_type);
```

**4. orchestrator_summary**
**File:** `/home/user/pmo/db/63_orchestrator_summary.ddl`

```sql
CREATE TABLE app.orchestrator_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES app.orchestrator_session(session_id),
  summary_type VARCHAR(50),             -- 'full', 'incremental', 'goal_completion'
  summary_text TEXT,                    -- Human-readable summary
  context_snapshot JSONB,               -- Context state at summary time
  goal_id VARCHAR(100),                 -- Goal associated with summary
  tokens_used INT,                      -- Tokens for summary generation
  created_ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestrator_summary_session ON app.orchestrator_summary(session_id);
```

**5. f_customer_interaction** (Existing table)
**File:** `/home/user/pmo/db/...` (existing)

```sql
CREATE TABLE app.f_customer_interaction (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interaction_number SERIAL,
  customer_id UUID,
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  interaction_type VARCHAR(50),         -- 'chat', 'voice', 'email'
  channel VARCHAR(50),                  -- 'live_chat', 'phone', 'web_widget'
  conversation_history JSONB,           -- Array of messages
  sentiment VARCHAR(50),                -- 'positive', 'neutral', 'negative'
  total_tokens INT,
  total_cost_cents INT,
  booking_created_flag BOOLEAN,
  closed_flag BOOLEAN,
  resolution VARCHAR(50),               -- 'resolved', 'abandoned', 'escalated'
  metadata JSONB,                       -- { orchestrator_session_id, current_goal, ... }
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ✨ Key Features

### Text Chat
- ✅ Server-Sent Events (SSE) streaming for token-by-token responses
- ✅ Session persistence in PostgreSQL
- ✅ Goal-oriented workflow (6 business goals)
- ✅ MCP tool integration (60+ API endpoints)
- ✅ Customer profile lookup/creation
- ✅ Task creation and employee assignment
- ✅ Calendar booking automation
- ✅ Conversation history tracking
- ✅ Sentiment analysis
- ✅ Debug logging with LLM prompt/response tracking

### Voice Chat
- ✅ WebSocket real-time voice (ChatWidget integration)
- ✅ HTTP POST voice (VoiceChat standalone)
- ✅ Deepgram Nova-2 Speech-to-Text
- ✅ ElevenLabs Text-to-Speech (6 voices)
- ✅ Voice Activity Detection (VAD)
- ✅ Streaming audio playback
- ✅ Audio queue management (prevents overlapping)
- ✅ Microphone permission handling
- ✅ Conversation end detection
- ✅ Voice consistency controls (stability, style)

### Session Memory (v6.0)
- ✅ LowDB-based storage (JSON file: `logs/contexts/session_memory_data.db.json`)
- ✅ Nested data structure (customer, service, operations, project, assignment)
- ✅ Deep merge for incremental updates (preserves existing fields)
- ✅ Per-session locking (atomic operations, prevents race conditions)
- ✅ MCP tools for read/write (`get_session_memory_data`, `update_data_extraction_fields`)
- ✅ Conversation summary tracking
- ✅ Goal traversal path recording
- ✅ RabbitMQ queue support (optional)

### Agent System
- ✅ Goal-oriented architecture (6 goals: GREET → GATHER → LOOKUP → DESIGN → EXECUTE → CONFIRM)
- ✅ Hybrid branching (deterministic + semantic routing)
- ✅ Unified goal agent (single LLM session per goal, conversational + MCP)
- ✅ Tool enrichment (auto-append context to API calls)
- ✅ Field validation (phone, address formats)
- ✅ Conversation tactics (empathy, rapport, consent)
- ✅ Loop prevention (max iterations per goal)
- ✅ Escalation triggers

### MCP Integration
- ✅ API manifest conversion to OpenAI tools (100+ endpoints → 60+ filtered tools)
- ✅ Dynamic tool filtering by category (Customer, Task, Employee, Calendar, Settings)
- ✅ Customer CRUD operations (`customer_get`, `customer_create`, `customer_update`)
- ✅ Task management (`task_create`, `task_update`, `task_list`)
- ✅ Employee lookup and assignment (`employee_list`, `employee_get`)
- ✅ Calendar booking (`person_calendar_book`, `person_calendar_list`)
- ✅ Settings/catalog queries (`setting_list`, `service_list`)
- ✅ Auto-field generation (customer code, cust_number)
- ✅ Session memory tools (`get_session_memory_data`, `update_data_extraction_fields`)

---

## 🔄 Data Flow

### Text Chat Flow (Streaming)

```
1. User Input
   User: "I need help with roof holes"
         ↓
2. Frontend (ChatWidget)
   POST /api/v1/chat/agent/message
   Body: { session_id, message, user_id, chat_session_id }
         ↓
3. API Route (routes.ts)
   → AgentOrchestratorService.processMessageStream()
         ↓
4. Agent Orchestrator
   → Load session state (current goal, context, history)
   → Goal: WARM_GREETINGS_EMPATHY_UNDERSTAND
         ↓
5. Unified Goal Agent
   → Build system prompt (agent profile + goal + tactics + context)
   → Call OpenAI with tools (streaming)
   → Tools: customer_get, customer_create, task_create, etc.
         ↓
6. OpenAI Response (Streaming)
   → Tokens: "I", "can", "help", "with", "that"
   → Tool call: update_data_extraction_fields({ service: { primary_request: "Roof hole repair" } })
         ↓
7. MCP Tool Execution
   → Execute update_data_extraction_fields
   → Update LowDB session memory (deep merge)
   → session_memory.service: { customer: {...}, service: { primary_request: "Roof hole repair" } }
         ↓
8. Goal Transition Evaluation
   → Check goal_success_criteria: mandatory_fields = ["service.primary_request"]
   → service.primary_request = "Roof hole repair" ✅
   → Check goal_branching_condition:
      - Deterministic: service.primary_request is_set → ELICIT_STRUCTURED_INFO ✅
   → Transition to ELICIT_STRUCTURED_INFO
         ↓
9. Save State
   → Update orchestrator_session (current_goal, context, metrics)
   → Update orchestrator_agent_log (LLM usage, MCP calls)
         ↓
10. Stream Response (SSE)
    → data: {"type":"token","token":"I"}
    → data: {"type":"token","token":" can"}
    → data: {"type":"token","token":" help"}
    → data: {"type":"done","response":"I can help with that roof repair! To get started, may I have your phone number?"}
         ↓
11. Frontend Display
    → Append tokens progressively
    → Show final message
    → Update UI (typing indicator off)
```

### Voice Call Flow (WebSocket)

```
1. User Speaks
   User speaks into microphone: "I need help with roof holes"
         ↓
2. Frontend (ChatWidget)
   → MediaRecorder captures audio chunks (WebM)
   → Convert to base64
   → Send via WebSocket:
      { type: 'audio.append', audio: base64 }
   → Voice Activity Detection detects silence (1.5s)
   → Send commit signal:
      { type: 'audio.commit' }
         ↓
3. WebSocket Handler (voice-langraph.routes.ts)
   → Receive audio chunks
   → Buffer audio until commit
   → Convert WebM → WAV (PCM16, 24kHz)
         ↓
4. Voice Orchestrator (processVoiceMessageStream)
   → Deepgram STT: WAV → "I need help with roof holes"
   → Call AgentOrchestratorService.processMessageStream(transcript)
         ↓
5. Agent Processing (same as text flow)
   → Unified Goal Agent
   → OpenAI streaming response
   → MCP tool calls
   → Goal transition
         ↓
6. Sentence Buffering
   → Tokens: "I", "can", "help", "with", "that", "roof", "repair", "!"
   → Buffer: "I can help with that roof repair!"
   → Detect sentence boundary (. ! ?)
         ↓
7. ElevenLabs TTS
   → Text: "I can help with that roof repair!"
   → Voice: "nova"
   → Generate MP3 audio chunk
   → Latency: ~75ms
         ↓
8. Stream Audio (WebSocket)
   → Send to client:
      {
        type: 'audio.chunk',
        audio: base64_mp3,
        transcript: "I can help with that roof repair!"
      }
         ↓
9. Frontend Playback
   → Receive audio chunk
   → Add to audio queue
   → Play sequentially (prevent overlapping)
   → AudioContext.decodeAudioData() → play()
         ↓
10. Continue Buffering
    → Next sentence: "To get started, may I have your phone number?"
    → TTS → stream → play
    → Repeat until response complete
         ↓
11. Signal Completion
    → Send: { type: 'audio.done', conversation_ended: false }
    → Update UI (status: listening)
```

---

## 🔌 MCP Integration

### MCP Tool Categories

**1. Session Memory Tools**
**File:** `/home/user/pmo/apps/api/src/modules/chat/orchestrator/mcp/session-memory-data-mcp.tools.ts`

```typescript
{
  name: 'get_session_memory_data',
  description: 'Retrieve the complete session memory data',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    }
  }
}

{
  name: 'get_context_data',
  description: 'Lightweight retrieval of specific context fields',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of field paths (e.g., ["customer.phone", "service.primary_request"])'
      }
    }
  }
}

{
  name: 'update_data_extraction_fields',
  description: 'Update session memory with extracted data (deep merge)',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      updates: {
        type: 'object',
        description: 'Nested updates (e.g., { customer: { phone: "555-1234" } })'
      }
    }
  }
}

{
  name: 'update_session_memory_data',
  description: 'Update session metadata (conversation_turn_count, node_path, summary)',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      updates: {
        type: 'object',
        properties: {
          conversation_turn_count: { type: 'number' },
          node_path: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' }
        }
      }
    }
  }
}
```

**2. Customer Tools** (from API manifest)

```typescript
{
  name: 'customer_get',
  description: 'Find existing customer by phone or email',
  parameters: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'Phone number (format: +1234567890)' },
      email: { type: 'string', description: 'Email address' }
    }
  }
}

{
  name: 'customer_create',
  description: 'Create a new customer profile. Auto-generates customer_code and cust_number.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name' },
      phone: { type: 'string', description: 'Phone number (required)' },
      email: { type: 'string', description: 'Email address' },
      address: { type: 'string', description: 'Full address (street, city, province, postal)' }
    },
    required: ['name', 'phone']
  }
}

{
  name: 'customer_update',
  description: 'Update existing customer profile',
  parameters: {
    type: 'object',
    properties: {
      customer_id: { type: 'string', description: 'Customer UUID' },
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      address: { type: 'string' }
    },
    required: ['customer_id']
  }
}
```

**3. Task Tools**

```typescript
{
  name: 'task_create',
  description: 'Create a new service task. Auto-appends customer info to description.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title (e.g., "Roof hole repair")' },
      description: { type: 'string', description: 'Detailed description of the work' },
      customer_id: { type: 'string', description: 'Customer UUID' },
      assignee_id: { type: 'string', description: 'Employee UUID assigned to task' },
      status: { type: 'string', description: 'Initial status (default: OPEN)' },
      priority: { type: 'string', description: 'Priority level (default: MEDIUM)' }
    },
    required: ['title', 'customer_id']
  }
}

{
  name: 'task_update',
  description: 'Update existing task',
  parameters: {
    type: 'object',
    properties: {
      task_id: { type: 'string' },
      status: { type: 'string' },
      assignee_id: { type: 'string' },
      description: { type: 'string' }
    },
    required: ['task_id']
  }
}

{
  name: 'task_list',
  description: 'List tasks with optional filters',
  parameters: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
      status: { type: 'string' },
      assignee_id: { type: 'string' }
    }
  }
}
```

**4. Employee Tools**

```typescript
{
  name: 'employee_list',
  description: 'List all employees (technicians, plumbers, electricians)',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: 'Filter by role (e.g., "technician")' },
      active: { type: 'boolean', description: 'Filter active employees only' }
    }
  }
}

{
  name: 'employee_get',
  description: 'Get employee details by ID',
  parameters: {
    type: 'object',
    properties: {
      employee_id: { type: 'string' }
    },
    required: ['employee_id']
  }
}
```

**5. Calendar Tools**

```typescript
{
  name: 'person_calendar_book',
  description: 'Book an appointment on employee calendar. Auto-creates calendar event linked to task.',
  parameters: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'Employee UUID' },
      start_time: { type: 'string', description: 'ISO 8601 datetime (e.g., 2025-11-15T10:00:00Z)' },
      end_time: { type: 'string', description: 'ISO 8601 datetime' },
      title: { type: 'string', description: 'Event title (e.g., "Roof repair - John Smith")' },
      description: { type: 'string', description: 'Event description with task details' },
      task_id: { type: 'string', description: 'Task UUID to link' }
    },
    required: ['person_id', 'start_time', 'end_time', 'title']
  }
}

{
  name: 'person_calendar_list',
  description: 'List employee availability',
  parameters: {
    type: 'object',
    properties: {
      person_id: { type: 'string' },
      start_date: { type: 'string', description: 'ISO 8601 date' },
      end_date: { type: 'string', description: 'ISO 8601 date' }
    },
    required: ['person_id']
  }
}
```

**6. Settings Tools**

```typescript
{
  name: 'service_list',
  description: 'List available home services (roof repair, plumbing, electrical, etc.)',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Filter by category' }
    }
  }
}

{
  name: 'setting_list',
  description: 'Get dropdown options for entity fields (status, priority, etc.)',
  parameters: {
    type: 'object',
    properties: {
      entity_type: { type: 'string', description: 'Entity type (e.g., "task", "project")' },
      field_name: { type: 'string', description: 'Field name (e.g., "status", "priority")' }
    },
    required: ['entity_type', 'field_name']
  }
}
```

### Tool Enrichment

**Auto-append Context to API Calls:**

```typescript
// Agent calls task_create
task_create({
  title: "Roof repair",
  description: "Fix roof holes",
  customer_id: "abc-123"
})

// MCP Adapter enriches description:
{
  title: "Roof repair",
  description: `Customer: John Smith
Phone: +1234567890
Address: 123 Main St, Toronto, ON, M1M 1M1
Service Request: Roof hole repair (urgent)

Details:
Fix roof holes`,
  customer_id: "abc-123"
}
```

**Auto-generate Fields:**

```typescript
// Agent calls customer_create
customer_create({
  name: "John Smith",
  phone: "+1234567890",
  email: "john@example.com"
})

// MCP Adapter adds:
{
  name: "John Smith",
  phone: "+1234567890",
  email: "john@example.com",
  customer_code: "CS-20251110-001",    // Auto-generated
  cust_number: 1001                    // Auto-incremented
}
```

---

## 📖 Usage Guide

### Starting the AI Chat System

```bash
# 1. Ensure all services are running
./tools/start-all.sh

# 2. Verify API is accessible
curl http://localhost:4000/health

# 3. Access chat interface
# Web: http://localhost:5173/chat
# Voice: http://localhost:5173/voice-chat

# 4. Monitor logs
./tools/logs-api.sh -f | grep "AgentOrchestrator"
```

### Testing Text Chat

```bash
# Create session
curl -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-123","name":"John","email":"john@example.com"}'

# Response:
{
  "session_id": "abc-123",
  "greeting": "Hello! How can I help you today?"
}

# Send message (non-streaming)
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "session_id":"abc-123",
    "message":"I need help with roof holes"
  }'

# Send message (streaming)
curl -X POST http://localhost:4000/api/v1/chat/message/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "session_id":"abc-123",
    "message":"I need help with roof holes"
  }'

# Response (SSE):
data: {"type":"token","token":"I"}
data: {"type":"token","token":" can"}
data: {"type":"token","token":" help"}
data: {"type":"done","response":"I can help with that roof repair! To get started, may I have your phone number?"}
```

### Testing Voice Chat

**Option 1: WebSocket Voice (ChatWidget)**

```bash
# Connect to WebSocket
wscat -c "ws://localhost:4000/api/v1/chat/voice/call?token=JWT_TOKEN"

# Send audio chunk (base64 encoded)
{
  "type": "audio.append",
  "audio": "BASE64_AUDIO_DATA"
}

# Commit audio (trigger processing)
{
  "type": "audio.commit"
}

# Receive audio response
{
  "type": "audio.chunk",
  "audio": "BASE64_MP3_AUDIO",
  "transcript": "I can help with that roof repair!"
}
```

**Option 2: HTTP Voice (VoiceChat)**

```bash
# Record audio file (WebM or WAV)
# Send to API
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer JWT_TOKEN" \
  -F "audio=@recording.webm" \
  -F "voice=nova" \
  -F "session_id=abc-123" \
  --output response.mp3

# Play response
mpg123 response.mp3
```

### Monitoring Agent Behavior

```bash
# View agent orchestrator logs
./tools/logs-api.sh | grep "AgentOrchestrator"

# View goal transitions
./tools/logs-api.sh | grep "GoalTransitionEngine"

# View MCP tool calls
./tools/logs-api.sh | grep "MCPAdapter"

# View LLM calls
./tools/logs-api.sh | grep "OpenAIService"

# View session memory updates
./tools/logs-api.sh | grep "SessionMemoryDataService"
```

**Example Log Output:**

```
[AgentOrchestrator] 📂 Creating new session for user user-123
[AgentOrchestrator] 🎯 Initial goal: WARM_GREETINGS_EMPATHY_UNDERSTAND
[AgentOrchestrator] 🌊 Streaming mode enabled
[UnifiedGoalAgent] 🎯 Executing goal: WARM_GREETINGS_EMPATHY_UNDERSTAND
[OpenAIService] 🤖 Calling GPT-4o mini (temp: 0.1, max tokens: 500)
[OpenAIService] 📤 Streaming 47 tokens
[UnifiedGoalAgent] 🔧 Tool call: update_data_extraction_fields
[MCPAdapter] 📝 Executing tool: update_data_extraction_fields
[SessionMemoryDataService] 💾 Updating session memory (deep merge)
[SessionMemoryDataService] ✅ Updated fields: service.primary_request
[GoalTransitionEngine] 🔍 Evaluating goal transition
[GoalTransitionEngine]    Deterministic: service.primary_request is_set → ✅ TRUE
[GoalTransitionEngine] ✅ MATCHED: Transition to ELICIT_STRUCTURED_INFO
[AgentOrchestrator] 🎯 Goal transition: WARM_GREETINGS_EMPATHY_UNDERSTAND → ELICIT_STRUCTURED_INFO
```

### Modifying Agent Behavior

**1. Add New Goal:**

Edit `/home/user/pmo/apps/api/src/modules/chat/orchestrator/agent_config.json`:

```json
{
  "goals": [
    // ... existing goals
    {
      "goal_id": "PROVIDE_QUOTE",
      "description": "Provide pricing quote for service",
      "primary_agent": "conversational_agent",
      "goal_success_criteria": {
        "evaluation_mode": "hybrid",
        "mandatory_fields": ["service.quote_amount"]
      },
      "conversation_tactics": ["transparency", "value_proposition"],
      "max_turns": 3,
      "goal_branching_condition": {
        "type": "hybrid",
        "rules": [
          {
            "priority": 10,
            "condition": "Customer accepts the quote",
            "next_goal": "EXECUTE_SOLUTION"
          },
          {
            "priority": 5,
            "condition": "Customer wants to negotiate or asks questions",
            "next_goal": "PROVIDE_QUOTE"  // Stay in goal
          }
        ]
      }
    }
  ]
}
```

**2. Add New Conversation Tactic:**

```json
{
  "conversation_tactics": {
    "value_proposition": {
      "description": "Emphasize value and benefits of service",
      "examples": [
        "Our service includes a 2-year warranty",
        "We use premium materials for long-lasting repairs",
        "Our technicians are certified and insured"
      ],
      "guidelines": [
        "Highlight quality and reliability",
        "Address cost concerns proactively",
        "Offer payment options if available"
      ]
    }
  }
}
```

**3. Add MCP Tool:**

Create new API endpoint, then run:

```bash
# Rebuild API manifest
npm run build:api

# Restart API server
./tools/restart-api.sh
```

MCP Adapter automatically discovers new endpoints and converts them to tools.

---

## 📊 Performance & Cost

### Latency Breakdown

**Text Chat (Streaming):**
```
User message sent: 0ms
    ↓
API receives request: 10ms
    ↓
Load session state: 20ms
    ↓
OpenAI first token: 200-500ms  ← FIRST TOKEN VISIBLE
    ↓
OpenAI streaming (500 tokens): 200-500ms × 50 chunks = 2-5s total
    ↓
MCP tool call (if needed): 50-200ms
    ↓
Goal transition evaluation: 1ms (deterministic) or 200-500ms (semantic)
    ↓
Save state: 20ms
    ↓
Total time to first token: ~230-530ms ✅
Total time to completion: ~3-6s
```

**Voice Chat (WebSocket):**
```
User speaks: 0ms
    ↓
Audio chunks sent: 100-500ms (while speaking)
    ↓
Silence detected: 1.5s delay
    ↓
Deepgram STT: 300-500ms
    ↓
Agent processing: 200-500ms (first token)
    ↓
Sentence buffering: 1-2s (wait for sentence boundary)
    ↓
ElevenLabs TTS: 75ms per chunk
    ↓
Audio playback starts: ~2.5-4s from silence detection ✅
    ↓
Progressive audio streaming: Sentence-by-sentence
```

### Cost Analysis

**Per Conversation Costs:**

```
Text Chat (10 messages):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent LLM calls:        10 × $0.002 = $0.020
MCP tool executions:     5 × $0     = $0      (API calls)
Goal transitions:        3 × $0.0002= $0.0006 (semantic)
Session memory ops:     20 × $0     = $0      (LowDB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                              ~$0.021
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Voice Chat (5 minutes, ~15 exchanges):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deepgram STT:          15 × $0.004 = $0.060
Agent LLM calls:       15 × $0.002 = $0.030
ElevenLabs TTS:        15 × $0.015 = $0.225
Goal transitions:       5 × $0.0002= $0.001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                              ~$0.316
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Cost per 1000 Customers:**
- Text chat: $21
- Voice chat: $316

**Optimization Tips:**
1. Use deterministic conditions (free) over semantic conditions ($0.0002 each)
2. Limit max conversation turns (reduce LLM calls)
3. Cache common queries (service lists, employee lists)
4. Use gpt-4o-mini instead of gpt-4 (40x cheaper)

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Goal Never Advances

**Symptoms:**
- Agent stays in first goal (WARM_GREETINGS_EMPATHY_UNDERSTAND)
- Never asks for customer contact information
- Data extraction works but workflow stuck

**Root Cause:**
Goal transition evaluation missing in streaming mode

**Solution:**
Verify goal transition logs:

```bash
./tools/logs-api.sh | grep "GoalTransitionEngine"
```

Expected output:
```
[GoalTransitionEngine] 🔍 Evaluating goal transition
[GoalTransitionEngine]    Deterministic: service.primary_request is_set → ✅ TRUE
[GoalTransitionEngine] ✅ MATCHED: Transition to ELICIT_STRUCTURED_INFO
```

If missing, check `agent-orchestrator.service.ts:processMessageStream()` method.

#### 2. Session Memory Not Updating

**Symptoms:**
- Context fields remain empty
- MCP tools not called
- Agent doesn't remember customer info

**Diagnostic:**

```bash
# Check session memory file
cat logs/contexts/session_memory_data.db.json

# View MCP tool calls
./tools/logs-api.sh | grep "update_data_extraction_fields"
```

**Possible Causes:**
- MCP tools not configured in agent profile
- Tool calls filtered out (check tool categories)
- Session memory service not initialized

**Solution:**
1. Verify agent profile has MCP capabilities
2. Check `agent_config.json` → `agent_profiles.conversational_agent.capabilities`
3. Verify LowDB file permissions: `chmod 644 logs/contexts/session_memory_data.db.json`

#### 3. Voice Audio Not Playing

**Symptoms:**
- WebSocket receives audio chunks
- No sound plays in browser
- Audio queue empty

**Diagnostic:**

```javascript
// Check browser console
console.log('Audio queue:', audioQueue);
console.log('Is playing:', isPlaying);
```

**Possible Causes:**
- AudioContext not initialized (user interaction required)
- Audio decoding failed (format mismatch)
- Audio queue blocked

**Solution:**

```javascript
// Initialize AudioContext on user gesture
button.addEventListener('click', async () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();
});

// Check audio format
const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
console.log('Audio blob size:', audioBlob.size);

// Clear audio queue
audioQueue = [];
isPlaying = false;
```

#### 4. High Latency (>5s response time)

**Symptoms:**
- Slow first token (>2s)
- Long wait for responses

**Diagnostic:**

```bash
# Check LLM call latency
./tools/logs-api.sh | grep "latency_ms"

# Check database query time
./tools/logs-api.sh | grep "session state loaded"
```

**Possible Causes:**
- OpenAI API slowness
- Large conversation history (too many tokens)
- Database connection pool exhausted
- Too many semantic conditions (LLM calls)

**Solution:**
1. Limit conversation history to last 10 turns
2. Use deterministic conditions first (priority 100)
3. Increase database connection pool size
4. Cache session state in Redis (instead of database lookup)

#### 5. MCP Tool Calls Failing

**Symptoms:**
- Tool calls attempted but error returned
- Agent says "I couldn't complete that action"
- Logs show MCP errors

**Diagnostic:**

```bash
# Check MCP tool errors
./tools/logs-api.sh | grep "MCPAdapter" | grep "error"

# Test API endpoint directly
./tools/test-api.sh POST /api/v1/customer '{"name":"Test","phone":"555-1234"}'
```

**Possible Causes:**
- API endpoint authentication required (JWT)
- Invalid tool parameters
- API rate limiting
- Database constraints (duplicate phone, etc.)

**Solution:**
1. Verify JWT token passed to MCP client
2. Check tool parameter validation in agent config
3. Add retry logic for transient errors
4. Improve tool error messages (add to system prompt)

#### 6. Conversation End Detection Not Working

**Symptoms:**
- Conversation continues after user says "goodbye"
- `conversation_ended` flag never set

**Diagnostic:**

```bash
# Check termination sequence logs
./tools/logs-api.sh | grep "termination_sequence"
```

**Possible Causes:**
- Termination sequence not configured in goal
- MCP tool `call_hangup` not available
- Goal never reaches terminal goal (CONFIRM_RESOLUTION)

**Solution:**

Add termination sequence to goal:

```json
{
  "goal_id": "CONFIRM_RESOLUTION",
  "is_terminal": true,
  "termination_sequence": {
    "steps": [
      {
        "step": 1,
        "action": "conversational_goodbye",
        "agent": "conversational_agent",
        "message_template": "Thank you for contacting Huron Home Services! Have a great day!"
      },
      {
        "step": 2,
        "action": "execute_mcp_hangup",
        "agent": "mcp_agent",
        "required_tool": "call_hangup"
      }
    ]
  }
}
```

---

## 📚 Related Documentation

- [Universal Entity System](../entity_design_pattern/universal_entity_system.md) - PMO entity architecture
- [Database Data Model](../datamodel/datamodel.md) - Complete database schema
- [API Documentation](http://localhost:4000/docs) - Fastify Swagger UI
- [Tools Guide](../tools.md) - Management scripts

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **v6.0** | 2025-11-10 | MCP-driven session memory with deep merge and atomic locking |
| **v5.0** | 2025-11-09 | Unified goal agent (single LLM session per goal) |
| **v4.0** | 2025-11-09 | Fast semantic routing (GPT-4o mini for yes/no decisions) |
| **v3.0** | 2025-11-08 | Goal-oriented architecture (6 business goals) |
| **v2.4** | 2025-11-07 | Soft semantic routing (LLM-based intent detection) |
| **v2.0** | 2025-10-15 | Multi-agent orchestration (17-node state machine) |
| **v1.0** | 2025-09-01 | Initial release (text chat only) |

---

**Last Updated:** 2025-11-10
**Maintained By:** PMO Platform Team
**Production URL:** http://100.26.224.246:5173/chat
**Version:** 6.0.0 (MCP-Driven Session Memory)
