# AI Chat System - Complete Architecture & Design Guide

> **Production-Ready Multi-Modal Conversational AI Platform** - Comprehensive documentation for text chat, voice calls, multi-agent orchestration, and goal-oriented workflows

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)]()
[![Architecture](https://img.shields.io/badge/architecture-goal--oriented--agentic-green.svg)]()
[![Streaming](https://img.shields.io/badge/streaming-SSE%20%2B%20TTS-orange.svg)]()
[![Status](https://img.shields.io/badge/status-production-success.svg)]()

---

## 📋 Table of Contents

1. [**Overview**](#-overview)
2. [**Quick Start**](#-quick-start)
3. [**System Architecture**](#-system-architecture)
4. [**Design Patterns**](#-design-patterns)
5. [**Multi-Agent Orchestration**](#-multi-agent-orchestration)
6. [**Goal-Based Workflow**](#-goal-based-workflow)
7. [**Streaming Architecture**](#-streaming-architecture)
8. [**Voice Processing**](#-voice-processing)
9. [**MCP Integration**](#-mcp-integration)
10. [**Configuration & Standards**](#-configuration--standards)
11. [**API Reference**](#-api-reference)
12. [**Development Guide**](#-development-guide)
13. [**Documentation Index**](#-documentation-index)

---

## 🎯 Overview

The **AI Chat System** is an enterprise-grade conversational AI platform designed for **Huron Home Services** that provides:

### **Core Capabilities**

✅ **Multi-Modal Communication**
- Text chat with Server-Sent Events (SSE) streaming
- Voice calls with real-time audio streaming
- Progressive response delivery (tokens/audio chunks)

✅ **Goal-Oriented Agentic Architecture**
- 5 business goals (UNDERSTAND → GATHER → DESIGN → EXECUTE → CONFIRM)
- Hybrid branching (deterministic + semantic routing)
- Declarative configuration (zero hardcoded logic)

✅ **Multi-Agent Coordination**
- 4 specialized agents (conversational, MCP, extraction, planner)
- Parallel execution (50%+ performance boost)
- ReAct pattern (Observe → Think → Act)

✅ **Advanced Features**
- Streaming responses (text + audio)
- MCP tool integration (booking, customer management)
- Session memory with JSON path resolution
- Declarative termination sequences

### **Performance Metrics**

| Metric | Value |
|--------|-------|
| **Text Response (First Token)** | 200-500ms |
| **Voice Response (First Audio)** | <1 second |
| **Goal Transitions** | 90% deterministic (instant), 10% semantic (LLM) |
| **Parallel Execution** | 50%+ faster than sequential |
| **LLM Model** | GPT-4o mini (cost-optimized) |
| **STT Accuracy** | 95%+ (Deepgram Nova-2) |
| **TTS Latency** | ~75ms per chunk (ElevenLabs Flash v2.5) |

### **Architecture Highlights**

```
Frontend (React 19)
    ↓
API Layer (Fastify v5, SSE/WebSocket)
    ↓
Multi-Agent Orchestrator
    ├─→ Worker Reply Agent (conversational)
    ├─→ Worker MCP Agent (tool execution)
    ├─→ Data Extraction Agent (context updates)
    └─→ Goal Transition Engine (hybrid branching)
    ↓
LLM Services (OpenAI GPT-4o mini)
    ↓
Voice Processing (Deepgram STT + ElevenLabs TTS)
    ↓
MCP Tools (booking, customer lookup, session memory)
    ↓
Database (PostgreSQL - sessions, logs, state)
```

---

## 🚀 Quick Start

### **Prerequisites**

```bash
# Required
Node.js 18+
pnpm
PostgreSQL 14+
OpenAI API key
Deepgram API key (for voice)
ElevenLabs API key (for voice)
```

### **Environment Setup**

```bash
# 1. Set environment variables
export OPENAI_API_KEY="sk-..."
export DEEPGRAM_API_KEY="..."      # For voice
export ELEVEN_LABS_API_KEY="..."  # For voice

# 2. Install dependencies
pnpm install

# 3. Import database schema
./tools/db-import.sh

# 4. Start all services
./tools/start-all.sh
```

### **Test Text Chat (Streaming)**

```bash
# Create session
SESSION_ID=$(./tools/test-api.sh POST /api/v1/chat/session/new \
  '{"customer_email":"test@example.com","customer_name":"John Doe"}' \
  | jq -r '.session_id')

# Send message with streaming
curl -N "http://localhost:4000/api/v1/chat/message/stream" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"I need help with my water heater\"}"

# Output (SSE):
# data: {"type":"token","token":"I'd"}
# data: {"type":"token","token":" be"}
# data: {"type":"token","token":" happy"}
# ...
# data: {"type":"done","sessionId":"...","response":"I'd be happy to help..."}
```

### **Test Voice Call**

```bash
# Open browser to widget
http://localhost:5174

# Click "Voice Call" button
# Speak: "I need help with my water heater"
# AI responds with progressive audio playback
```

---

## 🏛️ System Architecture

For a comprehensive component-by-component breakdown, see **[BUILDING_BLOCKS_PLAN.md](./BUILDING_BLOCKS_PLAN.md)**.

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                               │
│  ┌──────────────────┐          ┌──────────────────────────┐     │
│  │ Text Chat Widget │          │  Voice Call Widget       │     │
│  │ (React 19)       │          │  (WebSocket + Audio API) │     │
│  └────────┬─────────┘          └────────────┬─────────────┘     │
└───────────┼──────────────────────────────────┼───────────────────┘
            │ HTTP/SSE                         │ WebSocket
            ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Fastify v5)                     │
│  ┌──────────────────┐          ┌──────────────────────────┐     │
│  │ Text Chat Routes │          │  Voice WebSocket Routes  │     │
│  │ /message         │          │  /voice/call             │     │
│  │ /message/stream  │          │                          │     │
│  └────────┬─────────┘          └────────────┬─────────────┘     │
└───────────┼──────────────────────────────────┼───────────────────┘
            │                                  │
            └───────────┬──────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│            MULTI-AGENT ORCHESTRATION LAYER                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            Agent Orchestrator Service                  │    │
│  │  • Session management                                  │    │
│  │  • Goal transitions                                    │    │
│  │  • Parallel execution                                  │    │
│  │  • Termination sequences                               │    │
│  └───────────┬────────────────────────────────────────────┘    │
│              │                                                  │
│   ┌──────────┴──────────┬───────────────┬───────────────┐     │
│   ▼                     ▼               ▼               ▼     │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐  ┌──────┐    │
│  │ Worker      │  │ Worker   │  │ Data        │  │Planner│    │
│  │ Reply Agent │  │ MCP Agent│  │ Extraction  │  │Agent  │    │
│  │             │  │          │  │ Agent       │  │       │    │
│  │(Conversation│  │(Tool     │  │(Context     │  │(Plans)│    │
│  │  responses) │  │ calls)   │  │ updates)    │  │       │    │
│  └─────────────┘  └──────────┘  └─────────────┘  └──────┘    │
└─────────────────────────────────────────────────────────────────┘
            │                     │                    │
            ▼                     ▼                    ▼
┌─────────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  LLM SERVICES       │  │ VOICE        │  │  MCP INTEGRATION │
│                     │  │ PROCESSING   │  │                  │
│ ┌─────────────────┐ │  │              │  │ ┌──────────────┐ │
│ │ OpenAI Service  │ │  │ ┌──────────┐ │  │ │ MCP Client   │ │
│ │ (GPT-4o mini)   │ │  │ │ Deepgram │ │  │ │              │ │
│ │                 │ │  │ │ STT      │ │  │ │ Tools:       │ │
│ │ • callAgent()   │ │  │ │ (Nova-2) │ │  │ │ • booking    │ │
│ │ • callAgent     │ │  │ └──────────┘ │  │ │ • customer   │ │
│ │   Stream()      │ │  │              │  │ │ • session    │ │
│ └─────────────────┘ │  │ ┌──────────┐ │  │ │   memory     │ │
│                     │  │ │ElevenLabs│ │  │ └──────────────┘ │
│ ┌─────────────────┐ │  │ │ TTS      │ │  └──────────────────┘
│ │ LLM Logger      │ │  │ │ (Flash   │ │
│ │ (Centralized)   │ │  │ │  v2.5)   │ │
│ └─────────────────┘ │  │ └──────────┘ │
└─────────────────────┘  └──────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                STATE MANAGEMENT & DATABASE                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐       │
│  │ State        │  │  Session     │  │  PostgreSQL    │       │
│  │ Manager      │  │  Memory      │  │                │       │
│  │              │  │  Service     │  │  • Sessions    │       │
│  │(In-memory/   │  │              │  │  • LLM logs    │       │
│  │ Redis)       │  │(Flat context)│  │  • State       │       │
│  └──────────────┘  └──────────────┘  └────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Patterns

### **1. Goal-Oriented Architecture**

**Problem:** Rigid state machines with hardcoded transitions are brittle and hard to modify.

**Solution:** Replace with flexible business goals that adapt via hybrid branching.

**Before (v2.0):** 17 hardcoded nodes → rigid pattern matching
**After (v3.0):** 5 goals → hybrid branching (deterministic + semantic)

**Benefits:**
- ✅ Declarative configuration (modify JSON, not code)
- ✅ Hybrid branching (fast deterministic + flexible semantic)
- ✅ Easy to add/modify goals
- ✅ Non-developers can configure workflows

See **[BUILDING_BLOCKS_PLAN.md](./BUILDING_BLOCKS_PLAN.md)** for detailed implementation.

---

### **2. ReAct Pattern (Reason + Act)**

**Pattern:** Agents observe the situation, think about it, then act appropriately.

```
1. OBSERVE: Current goal, context, conversation history
2. THINK: Build prompt with goal description + tactics + context
3. ACT: Execute LLM call and return response
```

**Benefits:**
- ✅ Context-aware responses
- ✅ Reduces hallucinations (agent knows what it knows)
- ✅ Adaptive behavior (changes based on attempts)
- ✅ Explainable AI (prompt shows reasoning)

---

### **3. Hybrid Branching**

**Problem:** Pure deterministic routing is rigid; pure semantic routing is slow and expensive.

**Solution:** Combine both - use fast deterministic checks when possible, fall back to semantic for edge cases.

**Performance:**
- Deterministic: 0-1ms (instant JSON check)
- Semantic: 500-1000ms (LLM evaluation)
- Hybrid: 90% use deterministic (instant), 10% use semantic (flexible)

**Example:**
```json
{
  "auto_advance_conditions": [
    {
      "type": "deterministic",
      "json_path": "customer.phone",
      "operator": "is_set",
      "next_goal": "DESIGN_SOLUTION"
    },
    {
      "type": "semantic",
      "condition": "all mandatory fields collected",
      "next_goal": "DESIGN_SOLUTION"
    }
  ]
}
```

---

### **4. Parallel Agent Execution**

**Problem:** Sequential execution wastes time when agents have independent tasks.

**Solution:** Run independent agents simultaneously using Promise.all().

**Performance Impact:**
```
Sequential: 2000ms (1000ms reply + 1000ms extraction)
Parallel:   1100ms (both run simultaneously)
            ↓
           50% FASTER!
```

**Configuration:**
```json
{
  "agent_execution_strategy": {
    "mode": "parallel",
    "parallel_groups": [
      {
        "agents": ["conversational_agent", "extraction_agent"]
      }
    ]
  }
}
```

---

### **5. Progressive Streaming**

**Problem:** Blocking responses create 3-5 second waits, poor UX.

**Solution:** Yield results incrementally (tokens/audio chunks) as they're generated.

**Text Streaming (SSE):**
- First token arrives in 200-500ms
- Tokens displayed progressively (typewriter effect)
- Total time same, but feels 10x faster

**Voice Streaming (Sentence Buffering):**
- Buffer tokens until sentence boundary (. ! ? \n) or 100+ chars
- Send to ElevenLabs TTS (~75ms per chunk)
- Progressive audio playback
- First words play in <1 second

**Benefits:**
- ✅ Perceived latency: Near-zero
- ✅ Better UX: Progressive rendering/playback
- ✅ Maintains same total time, but feels 10x faster

---

## 🤖 Multi-Agent Orchestration

### **Agent Hierarchy**

```
┌────────────────────────────────────────────┐
│       Agent Orchestrator (Coordinator)     │
│  • Session management                      │
│  • Goal transitions                        │
│  • Parallel execution                      │
│  • State persistence                       │
└───────────┬────────────────────────────────┘
            │
    ┌───────┴────────┬──────────┬──────────┐
    ▼                ▼          ▼          ▼
┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐
│ Worker  │  │ Worker   │  │  Data   │  │Planner │
│ Reply   │  │ MCP      │  │Extract  │  │ Agent  │
│ Agent   │  │ Agent    │  │ Agent   │  │        │
└─────────┘  └──────────┘  └─────────┘  └────────┘

Conversational  Tool         Context    Planning
responses       execution    updates    solutions
```

### **Agent Specialization**

#### **1. Worker Reply Agent** (Conversational)
- **Purpose:** Generate natural language responses
- **Capabilities:** Empathetic listening, clarifying questions, rapport building
- **Model:** GPT-4o mini (temp 0.7, max 500 tokens)

#### **2. Worker MCP Agent** (Tool Execution)
- **Purpose:** Execute MCP tools (booking, customer lookup, etc.)
- **Available Tools:** customer_get, customer_create, task_create, person_calendar_book, call_hangup
- **Model:** GPT-4o mini (temp 0.3, max 300 tokens)

#### **3. Data Extraction Agent** (Context Updates)
- **Purpose:** Extract structured data from conversation
- **Schema:** customer{name,phone,email}, service{primary_request,urgency}, operations{solution_plan,task_id}
- **Model:** GPT-4o mini (temp 0.1, max 500 tokens, JSON mode)

#### **4. Planner Agent** (Solution Design)
- **Purpose:** Create solution plans for customer requests
- **Capabilities:** Multi-step planning, consent gathering
- **Model:** GPT-4o mini (temp 0.5, max 400 tokens)

---

## 🎯 Goal-Based Workflow

### **5 Business Goals**

```
┌───────────────────┐
│ UNDERSTAND_       │  "What does the customer need?"
│ REQUEST           │
└────────┬──────────┘
         │ Condition: service.primary_request is_set
         ▼
┌───────────────────┐
│ GATHER_           │  "Collect customer contact info"
│ REQUIREMENTS      │
└────────┬──────────┘
         │ Condition: customer.phone is_set
         ▼
┌───────────────────┐
│ DESIGN_           │  "Create solution plan"
│ SOLUTION          │
└────────┬──────────┘
         │ Condition: solution plan created + customer consents
         ▼
┌───────────────────┐
│ EXECUTE_          │  "Create tasks, book appointments"
│ SOLUTION          │
└────────┬──────────┘
         │ Condition: all actions executed successfully
         ▼
┌───────────────────┐
│ CONFIRM_          │  "Verify satisfaction + close"
│ RESOLUTION        │  (Terminal goal)
└───────────────────┘
```

### **Goal Configuration**

Each goal in `agent_config.json` defines:

- **goal_id:** Unique identifier (e.g., "GATHER_REQUIREMENTS")
- **description:** What the goal aims to achieve
- **goal_type:** conversational | conversational_with_mcp | planning | execution | terminal
- **primary_agent:** Which agent handles this goal
- **success_criteria:** Mandatory/conditional fields for completion
- **conversation_tactics:** Behavioral patterns (empathetic_listening, clarifying_questions, etc.)
- **retry_strategy:** Escalation messages, loop prevention
- **auto_advance_conditions:** When to transition to next goal
- **agent_execution_strategy:** Sequential | parallel | dependency_graph
- **termination_sequence:** Goodbye message + MCP hangup (terminal goals only)

See `/apps/api/src/modules/chat/orchestrator/agent_config.json` for full configuration.

---

## 🌊 Streaming Architecture

### **Text Streaming (Server-Sent Events)**

**Protocol:**
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"token","token":"I'd"}\n\n
data: {"type":"token","token":" be"}\n\n
data: {"type":"done","sessionId":"...","response":"..."}\n\n
```

**Implementation:**
- **Backend:** `agent-orchestrator.service.ts` → `processMessageStream()`
- **Route:** `POST /api/v1/chat/message/stream`
- **Frontend:** EventSource API

---

### **Voice Streaming (Progressive TTS)**

**Sentence Buffering Strategy:**
```
LLM tokens: "I'd", " be", " happy", " to", " help", "."
            └──────── buffer ────────┘          └→ Send to TTS

Buffer until:
  - Sentence boundary (. ! ? \n)
  - OR buffer > 100 characters

TTS: ~75ms per sentence
Progressive playback: First words in <1s
```

**Implementation:**
- **Backend:** `voice-orchestrator.service.ts` → `processVoiceMessageStream()`
- **Route:** WebSocket `/api/v1/chat/voice/call`
- **Frontend:** AudioContext for progressive playback

---

## 🎙️ Voice Processing

### **Speech-to-Text (Deepgram Nova-2)**

**Configuration:**
```typescript
{
  model: 'nova-2',        // Latest model (95%+ accuracy)
  language: 'en',
  smart_format: true,     // Auto punctuation
  punctuate: true
}
```

**Performance:**
- Latency: 300-500ms
- Accuracy: 95%+
- Cost: ~$0.005 per minute

---

### **Text-to-Speech (ElevenLabs Flash v2.5)**

**Configuration:**
```typescript
{
  model_id: 'eleven_flash_v2_5',  // Fastest (~75ms)
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true
  },
  output_format: 'mp3_44100_128'
}
```

**Available Voices:**
- `nova` (female, energetic) - **Default**
- `alloy` (male, neutral)
- `echo` (male, crisp)
- `fable` (male, warm)
- `onyx` (male, deep)
- `shimmer` (female, soft)

**Performance:**
- Latency: ~75ms per sentence
- Quality: Human-like, natural intonation
- Cost: ~$0.15 per 1000 characters

---

## 🔧 MCP Integration

**Model Context Protocol** allows agents to execute tools like booking appointments, fetching customer data, etc.

### **Available Tools**

| Tool | Purpose | Parameters |
|------|---------|------------|
| `customer_get` | Fetch customer | `{ phone?, email? }` |
| `customer_create` | Create customer | `{ name, phone, email }` |
| `task_create` | Create service task | `{ title, description, ... }` |
| `person_calendar_book` | Book appointment | `{ person_id, start_time, end_time }` |
| `setting_list` | List settings | `{ category }` |
| `call_hangup` | End chat session | `{}` |
| `session_memory_get` | Get session field | `{ field_path }` |
| `session_memory_set` | Set session field | `{ field_path, value }` |

### **Tool Execution Flow**

```typescript
// 1. Agent decides to use a tool
const action = await mcpAgent.getNextAction(goal, state, userMessage);

// 2. Execute MCP tool
const result = await mcpClient.executeTool('customer_get', {
  phone: state.context.customer.phone
});

// 3. Process result
if (result.success) {
  state.context.customer = { ...state.context.customer, ...result.data };
  return { response: `Found customer: ${result.data.name}` };
}
```

---

## ⚙️ Configuration & Standards

### **Agent Configuration File**

**Location:** `/apps/api/src/modules/chat/orchestrator/agent_config.json`

**Key Components:**
- **goals** - 5 business goals with transition conditions
- **agent_profiles** - Identity, capabilities, system prompts
- **conversation_tactics** - Reusable behavioral patterns

### **Session Memory Schema**

```json
{
  "customer": {
    "id": "uuid",
    "name": "string",
    "phone": "string",
    "email": "string"
  },
  "service": {
    "primary_request": "string",
    "urgency": "low | medium | high | emergency"
  },
  "operations": {
    "solution_plan": "string",
    "task_id": "uuid"
  }
}
```

### **Naming Conventions**

- **Goals:** VERB_NOUN (e.g., `UNDERSTAND_REQUEST`)
- **Fields:** snake_case (e.g., `customer.phone`)
- **Agents:** descriptive roles (e.g., `conversational_agent`)

---

## 📡 API Reference

### **Text Chat Endpoints**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/chat/session/new` | Create new session |
| POST | `/api/v1/chat/message` | Send message (blocking) |
| POST | `/api/v1/chat/message/stream` | Send message (streaming SSE) |
| GET | `/api/v1/chat/session/:id/history` | Get conversation history |
| POST | `/api/v1/chat/session/:id/close` | Close session |

### **Voice WebSocket**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/chat/voice/call` | WebSocket for voice calls |

**Client → Server Events:**
- `{ type: 'audio.append', audio: base64 }`
- `{ type: 'audio.commit' }`
- `{ type: 'audio.cancel' }`

**Server → Client Events:**
- `{ type: 'processing.started' }`
- `{ type: 'audio.chunk', audio: base64, transcript: '...' }`
- `{ type: 'audio.done', session_id, user_transcript, transcript, ... }`
- `{ type: 'error', error: '...' }`

---

## 🛠️ Development Guide

### **Adding a New Goal**

1. Edit `/apps/api/src/modules/chat/orchestrator/agent_config.json`
2. Add goal with required fields
3. Restart API: `./tools/restart-api.sh`
4. Test: `./tools/test-api.sh POST /api/v1/chat/message '...'`

### **Adding a New MCP Tool**

1. Create tool in `/apps/mcp-server/src/tools/`
2. Register in tool registry
3. Add to goal's `available_tools` array
4. Restart services

### **Modifying Agent Prompts**

1. Edit `agent_profiles` section in `agent_config.json`
2. Update `system_prompt`, `personality_traits`, etc.
3. Restart API: `./tools/restart-api.sh`

---

## 📚 Documentation Index

### **Core Documentation**

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[README.md](./README.md)** | **This file** - Complete system guide | Overview, architecture, patterns, API reference |
| **[BUILDING_BLOCKS_PLAN.md](./BUILDING_BLOCKS_PLAN.md)** | **Detailed component map** | All building blocks, dependencies, data flows, file organization |
| **[AI_CHAT_SYSTEM.md](./AI_CHAT_SYSTEM.md)** | Legacy system overview | Features, deployment, original architecture |

### **Technical Deep Dives**

| Document | Topic |
|----------|-------|
| **[AGENT_FLOW_ANALYSIS.md](./AGENT_FLOW_ANALYSIS.md)** | MCP nodes & auto-advance fixes |
| **[CONTEXT_STRUCTURE.md](./CONTEXT_STRUCTURE.md)** | Session memory data structure |
| **[DATA_EXTRACTION_FLOW.md](./DATA_EXTRACTION_FLOW.md)** | Extraction mechanism & flow |

### **Refactoring History**

| Document | Topic |
|----------|-------|
| **[AGENTIC_REFACTORING_PLAN.md](./AGENTIC_REFACTORING_PLAN.md)** | v2.0 → v3.0 migration plan (Part 1) |
| **[AGENTIC_REFACTORING_PLAN_PART2.md](./AGENTIC_REFACTORING_PLAN_PART2.md)** | v2.0 → v3.0 migration plan (Part 2) |
| **[AGENTIC_REFACTORING_PLAN_PART3.md](./AGENTIC_REFACTORING_PLAN_PART3.md)** | v2.0 → v3.0 migration plan (Part 3) |
| **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** | Complete refactoring summary |

### **Issue Analysis**

| Document | Topic |
|----------|-------|
| **[STATE_COHERENCE_ISSUES_ANALYSIS.md](./STATE_COHERENCE_ISSUES_ANALYSIS.md)** | State coherence issues |
| **[CRITICAL_BUGS_FOUND.md](./CRITICAL_BUGS_FOUND.md)** | Critical bugs identified |
| **[CRITICAL_FIXES_APPLIED.md](./CRITICAL_FIXES_APPLIED.md)** | Fixes applied |

### **Related PMO Documentation**

| Path | Topic |
|------|-------|
| `/docs/entity_design_pattern/` | Universal entity system |
| `/docs/datamodel/` | Database schema |
| `/docs/tools.md` | Platform tools reference |

---

## 🎓 Summary

The **AI Chat System** is a production-ready multi-modal conversational AI platform with:

✅ **Goal-oriented architecture** (5 flexible business goals)
✅ **Multi-agent orchestration** (4 specialized agents)
✅ **Hybrid branching** (90% deterministic, 10% semantic)
✅ **Streaming responses** (text SSE + voice TTS)
✅ **Parallel execution** (50%+ performance boost)
✅ **Declarative configuration** (zero hardcoded logic)
✅ **MCP integration** (booking, customer management)

**Performance:**
- First token: 200-500ms (text)
- First audio: <1 second (voice)
- 95%+ STT accuracy (Deepgram)
- ~75ms TTS latency (ElevenLabs)

**Tech Stack:**
- LLM: OpenAI GPT-4o mini
- STT: Deepgram Nova-2
- TTS: ElevenLabs Flash v2.5
- Backend: Fastify v5, TypeScript
- Frontend: React 19, Tailwind CSS v4
- Database: PostgreSQL 14+

---

**Version:** 3.0.0
**Last Updated:** 2025-11-09
**Status:** Production
**Maintainer:** Huron Home Services Engineering Team

---

**🚀 Ready to build? Start with [Quick Start](#-quick-start) or explore [Building Blocks](./BUILDING_BLOCKS_PLAN.md)!**
