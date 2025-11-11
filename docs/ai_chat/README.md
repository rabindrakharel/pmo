# AI Chat System Documentation

> **Complete Documentation Index for PMO AI Chat System** - Multi-modal conversational AI platform with text chat, voice calling, and automated operations

**Version:** 6.1.0 (Performance-Optimized)
**Last Updated:** 2025-11-11
**Status:** Production

---

## 📚 Documentation Index

### 🎯 Getting Started

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| **[Quick Start Guide](./QUICK_START.md)** | Get AI chat running in 5 minutes | Developers, New Contributors | 5 min |
| **[Architecture Overview](./AI_CHAT_SYSTEM.md#architecture)** | High-level system design | Architects, Technical Leads | 15 min |

### 📖 Core Documentation

| Document | Purpose | When to Use | Size |
|----------|---------|-------------|------|
| **[AI Chat System](./AI_CHAT_SYSTEM.md)** | **⭐ Complete system documentation** | Understanding the entire platform, architecture, implementation | 74KB, ~2,300 lines |
| **[Project/Task Agent](./PROJECT_TASK_AGENT_CONFIG.md)** | Specialized stakeholder agent configuration | Building custom agent configs, query systems | 26KB, ~950 lines |

### 🛠️ Developer Guides

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[MCP Tools Reference](./MCP_TOOLS_REFERENCE.md)** | Complete MCP tool catalog and usage | Implementing new MCP tools, troubleshooting tool calls |
| **[Agent Configuration Guide](./AGENT_CONFIG_GUIDE.md)** | How to create/modify agent configs | Building custom agents, changing workflow |
| **[Voice Integration Guide](./VOICE_INTEGRATION.md)** | Deepgram + ElevenLabs integration | Implementing voice features, debugging audio |
| **[Session Memory Guide](./SESSION_MEMORY.md)** | LowDB session storage patterns | Understanding context management, state persistence |

### 🚀 Deployment & Operations

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[Deployment Guide](./DEPLOYMENT.md)** | AI chat deployment procedures | Deploying to production, CI/CD setup |
| **[Monitoring Guide](./MONITORING.md)** | Logging, metrics, debugging | Troubleshooting issues, performance tuning |
| **[Cost Optimization](./COST_OPTIMIZATION.md)** | Reducing LLM/API costs | Budget optimization, scaling strategies |

### 📝 Changelogs & Updates

| Document | Date | Changes |
|----------|------|---------|
| **[Service Catalog Fix](../../CHANGELOG_AI_CHAT_SERVICE_CATALOG_FIX.md)** | 2025-11-09 | Service catalog MCP integration, loop prevention |

---

## 🗺️ Documentation Navigation by Task

### I want to understand the AI chat system

**Start here:**
1. [System Overview](./AI_CHAT_SYSTEM.md#system-overview) - 5 min
2. [Architecture](./AI_CHAT_SYSTEM.md#architecture) - 10 min
3. [Key Features](./AI_CHAT_SYSTEM.md#key-features) - 5 min

**Then dive into:**
- [Data Flow](./AI_CHAT_SYSTEM.md#data-flow) - How requests flow through the system
- [Goal Workflow](./AI_CHAT_SYSTEM.md#goal-workflow) - 6-goal customer service journey
- [MCP Integration](./AI_CHAT_SYSTEM.md#mcp-integration) - API tool integration

---

### I want to build a custom AI agent

**Essential reading:**
1. [Agent Configuration Guide](./AGENT_CONFIG_GUIDE.md) - ⭐ Start here
2. [Project/Task Agent Example](./PROJECT_TASK_AGENT_CONFIG.md) - Real-world example
3. [MCP Tools Reference](./MCP_TOOLS_REFERENCE.md) - Available tools
4. [Agent Orchestrator Service](./AI_CHAT_SYSTEM.md#1-agent-orchestrator-service) - How agents execute

**Configuration files:**
- `/apps/api/src/modules/chat/orchestrator/agent_config.json` - Customer service agent
- `/apps/api/src/modules/chat/orchestrator/agent_config_projecttask.json` - Project/task agent

---

### I want to implement voice chat

**Essential reading:**
1. [Voice Integration Guide](./VOICE_INTEGRATION.md) - Complete voice setup
2. [Voice Orchestrator Service](./AI_CHAT_SYSTEM.md#3-voice-orchestrator-service) - Backend architecture
3. [ChatWidget Component](./AI_CHAT_SYSTEM.md#1-chatwidget-component) - Frontend integration

**Key services:**
- Deepgram Nova-2 (Speech-to-Text)
- ElevenLabs Flash v2.5 (Text-to-Speech)
- WebSocket streaming architecture

---

### I want to add MCP tools

**Essential reading:**
1. [MCP Tools Reference](./MCP_TOOLS_REFERENCE.md) - Tool catalog
2. [MCP Adapter Service](./AI_CHAT_SYSTEM.md#4-mcp-adapter-service) - Tool conversion
3. [Tool Enrichment](./AI_CHAT_SYSTEM.md#tool-enrichment) - Auto-context injection

**Implementation steps:**
1. Create API endpoint in `/apps/api/src/modules/`
2. Update API manifest in `/apps/mcp-server/src/api-manifest.ts`
3. MCP adapter auto-discovers and converts to OpenAI tool
4. Add tool to agent config `available_tools` array

---

### I want to deploy AI chat to production

**Essential reading:**
1. [Deployment Guide](./DEPLOYMENT.md) - Deployment procedures
2. [Environment Variables](./AI_CHAT_SYSTEM.md#3-environment-variables) - Required configs
3. [Monitoring Guide](./MONITORING.md) - Production monitoring

**Deployment checklist:**
- [ ] Set OpenAI API key (`OPENAI_API_KEY`)
- [ ] Set Deepgram API key (`DEEPGRAM_API_KEY`)
- [ ] Set ElevenLabs API key (`ELEVEN_LABS_API_KEY`)
- [ ] Configure voice settings
- [ ] Run database migrations (4 new tables)
- [ ] Test session memory persistence
- [ ] Verify MCP tool connectivity
- [ ] Enable logging (`VERBOSE_AGENT_LOGS=true`)

---

### I want to troubleshoot issues

**Common issues:**
1. [Goal Never Advances](./AI_CHAT_SYSTEM.md#1-goal-never-advances) - Workflow stuck
2. [Session Memory Not Updating](./AI_CHAT_SYSTEM.md#2-session-memory-not-updating) - Context issues
3. [Voice Audio Not Playing](./AI_CHAT_SYSTEM.md#3-voice-audio-not-playing) - Audio problems
4. [High Latency](./AI_CHAT_SYSTEM.md#4-high-latency-5s-response-time) - Performance issues
5. [MCP Tool Calls Failing](./AI_CHAT_SYSTEM.md#5-mcp-tool-calls-failing) - Tool errors

**Debugging tools:**
```bash
# View agent logs
./tools/logs-api.sh | grep "AgentOrchestrator"

# View goal transitions
./tools/logs-api.sh | grep "GoalTransitionEngine"

# View MCP tool calls
./tools/logs-api.sh | grep "MCPAdapter"

# View session memory updates
./tools/logs-api.sh | grep "SessionMemoryDataService"

# Check session memory file
cat logs/contexts/session_memory_data.db.json
```

---

## 🏗️ System Architecture Quick Reference

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **LLM** | OpenAI GPT-4o mini | Conversational responses, tool selection |
| **STT** | Deepgram Nova-2 | Speech-to-text transcription |
| **TTS** | ElevenLabs Flash v2.5 | Text-to-speech audio generation |
| **Backend** | Fastify v5, TypeScript | API routes, orchestration |
| **Frontend** | React 19, TypeScript | Chat UI, voice interface |
| **Session Storage** | LowDB (JSON file) | Session memory persistence |
| **Database** | PostgreSQL 14+ | Session state, agent logs |
| **Real-time** | WebSocket, SSE | Voice streaming, text streaming |

### Core Services

```
┌─────────────────────────────────────────────────────────────┐
│                   AI CHAT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (React)                                           │
│  ├── ChatWidget.tsx      → Text + Voice UI                 │
│  └── VoiceChat.tsx       → Standalone voice                 │
│                                                              │
│  ↓ HTTP/WebSocket                                           │
│                                                              │
│  API Routes (Fastify)                                       │
│  ├── /api/v1/chat/session/new                              │
│  ├── /api/v1/chat/message/stream (SSE)                     │
│  ├── /api/v1/chat/voice/call (WebSocket)                   │
│  └── /api/v1/chat/orchestrator/voice (HTTP)                │
│                                                              │
│  ↓                                                           │
│                                                              │
│  Orchestration Layer                                        │
│  ├── AgentOrchestratorService → Goal workflow manager      │
│  ├── UnifiedGoalAgent          → LLM + MCP execution       │
│  ├── GoalTransitionEngine      → Hybrid branching          │
│  ├── VoiceOrchestratorService  → STT + TTS pipeline        │
│  └── SessionMemoryDataService  → LowDB storage             │
│                                                              │
│  ↓                                                           │
│                                                              │
│  External Services                                          │
│  ├── OpenAI GPT-4o mini       → LLM reasoning              │
│  ├── Deepgram Nova-2           → Speech-to-text            │
│  ├── ElevenLabs Flash v2.5     → Text-to-speech            │
│  └── MCP Server (60+ tools)    → API function calling      │
│                                                              │
│  ↓                                                           │
│                                                              │
│  Storage                                                    │
│  ├── PostgreSQL               → Session state, logs        │
│  └── LowDB (JSON)             → Session memory data        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6-Goal Workflow

```
1. WARM_GREETINGS_EMPATHY_UNDERSTAND
   → Welcome customer, understand primary request
   ↓

2. ELICIT_STRUCTURED_INFO
   → Collect contact information (phone, name, email, address)
   ↓

3. LOOKUP_UPDATE_CREATE_RECORDS
   → Search/create customer profile via MCP
   ↓

4. DESIGN_SOLUTION
   → Create solution plan, assign employee
   ↓

5. EXECUTE_SOLUTION
   → Create task, book appointment via MCP
   ↓

6. CONFIRM_RESOLUTION
   → Verify satisfaction, summarize actions, close
```

---

## 📊 Performance & Cost Quick Reference

### Latency

| Metric | Value | Notes |
|--------|-------|-------|
| **First token (text)** | 200-500ms | With proactive warm-up |
| **First audio (voice)** | ~1 second | STT + LLM + TTS |
| **Text conversation** | 3-6s total | Streaming, 500 tokens |
| **Voice conversation** | 2.5-4s | From silence to playback |

### Cost per Conversation

| Type | LLM Calls | External APIs | Total Cost |
|------|-----------|---------------|------------|
| **Text chat (10 msgs)** | $0.020 | $0 | ~$0.021 |
| **Voice chat (5 min, 15 exchanges)** | $0.030 | $0.286 (STT+TTS) | ~$0.316 |

**Cost per 1000 customers:**
- Text: $21
- Voice: $316

### Optimization Tips

1. **Use deterministic conditions first** (free, instant)
2. **Use compound conditions** (`all_of`, `any_of`) for multi-field checks
3. **Enable proactive warm-up** (28% faster first response)
4. **Parallel MCP execution** (zero added latency)
5. **Cache session state** in Redis (avoid DB lookups)
6. **Limit conversation history** to last 10 turns

---

## 🔑 Key Concepts

### Goal-Oriented Architecture

**Traditional approach:**
- 17-node state machine
- Complex branching logic
- Hard to maintain

**Goal-oriented approach (v3.0+):**
- 6 business goals
- Declarative configuration
- Easy to modify/extend

### Hybrid Branching

**3 types of conditions:**

1. **Deterministic** (~1ms, free)
   ```json
   {"json_path": "customer.phone", "operator": "is_set"}
   ```

2. **Compound** (~1ms per sub-condition, free)
   ```json
   {"all_of": [
     {"json_path": "customer.phone", "operator": "is_set"},
     {"json_path": "customer.name", "operator": "is_set"}
   ]}
   ```

3. **Semantic** (200-500ms, $0.0002)
   ```json
   "Customer confirmed they want to proceed with booking"
   ```

### Session Memory Deep Merge

**Problem:** Simple updates overwrite nested data

**Solution:** Deep merge preserves existing fields

```typescript
// Existing memory
{ customer: { name: "John" }, service: { primary_request: "Roof repair" } }

// Update
{ customer: { phone: "555-1234" } }

// Result (deep merge)
{ customer: { name: "John", phone: "555-1234" }, service: { primary_request: "Roof repair" } }
```

### Proactive Session Warm-Up

**Problem:** Cold start latency on goal transitions

**Solution:** Pre-initialize next goal session

```typescript
// On goal transition
state = updateCurrentNode(state, nextGoal);

// Pre-initialize session (reduces first response latency by 28%)
unifiedGoalAgent.warmUpGoalSession(nextGoal, sessionId, state);
```

---

## 🧪 Testing & Development

### Local Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your API keys

# 3. Start database
docker-compose up -d postgres

# 4. Run database migrations
./tools/db-import.sh

# 5. Start API server
cd apps/api && pnpm dev

# 6. Start web app
cd apps/web && pnpm dev

# 7. Test AI chat
# Web: http://localhost:5173/chat
# API: http://localhost:4000/api/v1/chat/session/new
```

### Testing Endpoints

```bash
# Create session
curl -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","name":"Test User"}'

# Send message (streaming)
curl -X POST http://localhost:4000/api/v1/chat/message/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"session_id":"SESSION_ID","message":"I need help with roof holes"}'

# Test voice (HTTP)
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer TOKEN" \
  -F "audio=@recording.webm" \
  -F "voice=nova" \
  --output response.mp3
```

### Monitoring Logs

```bash
# Agent orchestrator
./tools/logs-api.sh | grep "AgentOrchestrator"

# Goal transitions
./tools/logs-api.sh | grep "GoalTransitionEngine"

# MCP tools
./tools/logs-api.sh | grep "MCPAdapter"

# Session memory
./tools/logs-api.sh | grep "SessionMemoryDataService"

# Voice processing
./tools/logs-api.sh | grep "VoiceOrchestrator"
```

---

## 📞 Support & Contributing

### Getting Help

- **Issues:** Check [Troubleshooting](./AI_CHAT_SYSTEM.md#troubleshooting) section
- **Logs:** Enable verbose logging (`VERBOSE_AGENT_LOGS=true`)
- **Database:** Query `app.orchestrator_session` and `app.orchestrator_agent_log`

### Contributing

1. Read [AI Chat System](./AI_CHAT_SYSTEM.md) for architecture understanding
2. Check [Agent Configuration Guide](./AGENT_CONFIG_GUIDE.md) for config patterns
3. Follow TypeScript best practices
4. Test with both text and voice chat
5. Update documentation for new features

---

## 📄 License

MIT License - See main [LICENSE](../../LICENSE) file

---

## 🔗 Related Documentation

### PMO Platform Documentation

- [📖 Complete Documentation Index](../README.md) - All platform docs
- [🏗️ Universal Entity System](../entity_design_pattern/universal_entity_system.md) - DRY architecture
- [💾 Database Data Model](../datamodel/datamodel.md) - Complete schema
- [🛠️ Management Tools](../tools.md) - Operational scripts

### External Resources

- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Deepgram API Docs](https://developers.deepgram.com/)
- [ElevenLabs API Docs](https://docs.elevenlabs.io/)
- [Fastify Documentation](https://fastify.dev/)
- [React 19 Documentation](https://react.dev/)

---

**Last Updated:** 2025-11-11
**Maintained By:** PMO Platform Team
**Version:** 6.1.0 (Performance-Optimized)
**Production URL:** http://100.26.224.246:5173/chat
